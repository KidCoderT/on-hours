import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { parseSettings, type SettingKey, type Settings } from "./settings";
import { addDays, startOfDay } from "./time";

// A day's goal and stretch rows are keyed by its work-day start, as it was when written. Look them
// up by calendar date, so moving "day start" doesn't orphan every past day's row.
const dateOf = (ms: number) => startOfDay(new Date(ms));
const dateSpan = (day: number) => [+dateOf(day), +addDays(dateOf(day), 1)];

// The DB is opened + migrated by Rust at startup (`preload` in tauri.conf.json),
// so every window shares that one connection. File: %APPDATA%/com.tejas.on-hours/on-hours.db
export const db = Database.get("sqlite:on-hours.db");

export type Session = { id: number; start_ms: number; end_ms: number; open: number };

/* ---------- sessions ---------- */

/** Sessions overlapping [from, to), oldest first. */
export const sessionsBetween = (from: number, to: number) =>
  db.select<Session[]>(
    "SELECT * FROM sessions WHERE end_ms > $1 AND start_ms < $2 ORDER BY start_ms",
    [from, to],
  );

/** Start of the very first session, or null if nothing is logged yet. */
export const firstSessionStart = async () =>
  (await db.select<{ t: number | null }[]>("SELECT MIN(start_ms) AS t FROM sessions"))[0]?.t ?? null;

/** End of the most recent closed session, or null: how long the user has been paused. */
export const lastSessionEnd = async () =>
  (await db.select<{ t: number | null }[]>("SELECT MAX(end_ms) AS t FROM sessions WHERE open = 0"))[0]?.t ?? null;

export const startSession = (now = Date.now()) =>
  db.execute("INSERT INTO sessions (start_ms, end_ms, open) VALUES ($1, $2, 1)", [now, now]);

/** A running session whose last heartbeat is this old wasn't running: the PC slept, crashed or shut down. */
export const STALE_MS = 2 * 60_000;

type Conn = Pick<Database, "execute">;

/**
 * Every write that moves the running session's end goes through here. If its last heartbeat is
 * stale (the PC slept with the timer on), it is closed at that heartbeat instead, so the sleep
 * never counts. Returns true if `now` was written, false if there was no fresh running session.
 */
export async function touchOpen(now: number, pause: boolean, conn: Conn = db) {
  const fresh = await conn.execute(
    "UPDATE sessions SET end_ms = $1, open = $2 WHERE open = 1 AND $1 - end_ms < $3",
    [now, pause ? 0 : 1, STALE_MS],
  );
  if (fresh.rowsAffected) return true;
  await conn.execute("UPDATE sessions SET open = 0 WHERE open = 1 AND $1 - end_ms >= $2", [now, STALE_MS]);
  return false;
}

/** Called every ~30s while running, so a crash loses at most that much. False: the session is closed. */
export const heartbeat = (now = Date.now()) => touchOpen(now, false);

/** Sessions shorter than this are misclicks: pausing drops them instead of logging a blip. */
export const MIN_SESSION_MS = 5_000;

/** True if paused at `now`; false if the session had gone stale and was closed at its last heartbeat. */
export async function pauseSession(now = Date.now(), conn: Conn = db) {
  const atNow = await touchOpen(now, true, conn);
  if (atNow) {
    await conn.execute(
      "DELETE FROM sessions WHERE id = (SELECT MAX(id) FROM sessions) AND open = 0 AND end_ms - start_ms < $1",
      [MIN_SESSION_MS],
    );
  }
  return atNow;
}

/** Quit without leaving a session open: reopening within STALE_MS would resume it and count the gap. */
export const quitApp = () =>
  pauseSession()
    .catch((e) => console.error("could not pause before quitting", e))
    .finally(() => invoke("quit"));

/**
 * On launch: a recent open session (reload / quick restart) keeps running and is returned.
 * A stale one (shutdown / crash) is closed at its last heartbeat, so off-time never counts.
 */
export async function recoverOpenSession(now = Date.now(), conn: Pick<Database, "execute" | "select"> = db): Promise<Session | null> {
  const [open] = await conn.select<Session[]>("SELECT * FROM sessions WHERE open = 1");
  if (!open) return null;
  if (now - open.end_ms < STALE_MS) {
    // Resumed: stamp it now, or the first heartbeat (30s on) could find the old end stale and close it.
    await conn.execute("UPDATE sessions SET end_ms = $1 WHERE id = $2", [now, open.id]);
    return open;
  }
  await conn.execute("UPDATE sessions SET open = 0 WHERE id = $1", [open.id]);
  return null;
}

/** The most recently ended session: the one an away-pause just closed. */
export const lastClosedSession = async () =>
  (await db.select<Session[]>("SELECT * FROM sessions WHERE open = 0 ORDER BY end_ms DESC LIMIT 1"))[0] ?? null;

/**
 * "I was working": reopen the session an away-pause closed, stamped at `now` so the first heartbeat
 * finds it fresh. Only if nothing happened since: it is still the latest session, still ends at
 * `end`, and no other session is running. True if reopened.
 */
export async function reopenSession(id: number, end: number, now: number, conn: Conn = db) {
  const r = await conn.execute(
    `UPDATE sessions SET open = 1, end_ms = $1
     WHERE id = $2 AND end_ms = $3 AND open = 0
       AND id = (SELECT MAX(id) FROM sessions) AND NOT EXISTS (SELECT 1 FROM sessions WHERE open = 1)`,
    [now, id, end],
  );
  return r.rowsAffected > 0;
}

/* ---------- breaks ---------- */

export type Break = { id: number; start_ms: number; end_ms: number };

/** The most recent break, running or over: the pill counts a running one down, and nags right after one. */
export const lastBreak = async (conn: Pick<Database, "select"> = db) =>
  (await conn.select<Break[]>("SELECT * FROM breaks ORDER BY start_ms DESC LIMIT 1"))[0] ?? null;

/** Breaks overlapping [from, to), oldest first. */
export const breaksBetween = (from: number, to: number) =>
  db.select<Break[]>("SELECT * FROM breaks WHERE end_ms > $1 AND start_ms < $2 ORDER BY start_ms", [from, to]);

/** Cut a running break short at `now`. Does nothing when no break is running. */
export const endBreak = (now = Date.now(), conn: Conn = db) =>
  conn.execute("UPDATE breaks SET end_ms = $1 WHERE start_ms <= $1 AND end_ms > $1", [now]);

/** Start a break of `ms`. A break already running ends here, so breaks never overlap. */
export async function startBreak(now: number, ms: number, conn: Conn = db) {
  await endBreak(now, conn);
  await conn.execute("INSERT INTO breaks (start_ms, end_ms) VALUES ($1, $2)", [now, now + ms]);
}

/* ---------- PC on ---------- */

export type Awake = { id: number; start_ms: number; end_ms: number };

/**
 * Extend the current "PC on" stretch to `now`, or start a new one after a gap longer than
 * STALE_MS (sleep, shutdown, app closed) or a clock that moved back.
 */
export async function markAwake(now = Date.now(), conn: Conn = db) {
  const extended = await conn.execute(
    "UPDATE awake SET end_ms = $1 WHERE id = (SELECT MAX(id) FROM awake) AND $1 >= end_ms AND $1 - end_ms < $2",
    [now, STALE_MS],
  );
  if (!extended.rowsAffected) await conn.execute("INSERT INTO awake (start_ms, end_ms) VALUES ($1, $1)", [now]);
}

/** "PC on" stretches overlapping [from, to), oldest first. */
export const awakeBetween = (from: number, to: number) =>
  db.select<Awake[]>("SELECT * FROM awake WHERE end_ms > $1 AND start_ms < $2 ORDER BY start_ms", [from, to]);

/* ---------- stretch ---------- */

/** Extra time added to the day starting at `day` (its work-day start), 0 if none. */
export const extraFor = async (day: number, conn: Pick<Database, "select"> = db) =>
  (await conn.select<{ ms: number | null }[]>("SELECT SUM(extra_ms) AS ms FROM day_extra WHERE day_ms >= $1 AND day_ms < $2", dateSpan(day)))[0]?.ms ?? 0;

/** "Push another 30 minutes": add `ms` to that day's goal. Adds up when said yes again. */
export const addExtra = (day: number, ms: number, conn: Conn = db) =>
  conn.execute(
    "INSERT INTO day_extra (day_ms, extra_ms) VALUES ($1, $2) ON CONFLICT(day_ms) DO UPDATE SET extra_ms = day_extra.extra_ms + excluded.extra_ms",
    [day, ms],
  );

/** The goal was changed in settings: that day's stretch is dropped. */
export const clearExtra = (day: number, conn: Conn = db) => conn.execute("DELETE FROM day_extra WHERE day_ms >= $1 AND day_ms < $2", dateSpan(day));

/** Each day's extra for the work days in [from, to), keyed by the day's date (local midnight). */
export const extrasBetween = async (from: number, to: number, conn: Pick<Database, "select"> = db) => {
  const rows = await conn.select<{ day_ms: number; extra_ms: number }[]>("SELECT * FROM day_extra WHERE day_ms >= $1 AND day_ms < $2", [+dateOf(from), +dateOf(to)]);
  const m = new Map<number, number>();
  for (const r of rows) m.set(+dateOf(r.day_ms), (m.get(+dateOf(r.day_ms)) ?? 0) + r.extra_ms);
  return m;
};

/* ---------- each day's goal ---------- */

/** Remember the goal `day` (its work-day start) is judged against. Today's follows the setting. */
export async function setDayGoal(day: number, ms: number, conn: Conn = db) {
  // One row per date: a row from before "day start" moved is replaced, not left to compete.
  await conn.execute("DELETE FROM day_goal WHERE day_ms >= $1 AND day_ms < $2 AND day_ms != $3", [...dateSpan(day), day]);
  await conn.execute("INSERT INTO day_goal (day_ms, goal_ms) VALUES ($1, $2) ON CONFLICT(day_ms) DO UPDATE SET goal_ms = excluded.goal_ms", [day, ms]);
}

/** Each day's goal for the work days in [from, to), keyed by the day's date (local midnight). */
export const goalsBetween = async (from: number, to: number, conn: Pick<Database, "select"> = db) =>
  new Map((await conn.select<{ day_ms: number; goal_ms: number }[]>("SELECT * FROM day_goal WHERE day_ms >= $1 AND day_ms < $2 ORDER BY day_ms", [+dateOf(from), +dateOf(to)])).map((r) => [+dateOf(r.day_ms), r.goal_ms]));

/* ---------- editing history (Settings) ---------- */

// No other session in [$1, $2), checked in the same statement as the write. The running one reaches
// to now, past any end the editor accepts, so it overlaps whatever ends after it started.
const FREE = "NOT EXISTS (SELECT 1 FROM sessions WHERE id IS NOT $3 AND start_ms < $2 AND (open = 1 OR end_ms > $1))";

/** Add a finished session by hand. False: it overlaps another session, nothing saved. */
export const addSession = async (start: number, end: number, conn: Conn = db) =>
  (await conn.execute(`INSERT INTO sessions (start_ms, end_ms, open) SELECT $1, $2, 0 WHERE ${FREE}`, [start, end, null])).rowsAffected > 0;

/** Change a finished session's times. The running one is the timer's: never touched here. False: not saved. */
export const editSession = async (id: number, start: number, end: number, conn: Conn = db) =>
  (await conn.execute(`UPDATE sessions SET start_ms = $1, end_ms = $2 WHERE id = $3 AND open = 0 AND ${FREE}`, [start, end, id])).rowsAffected > 0;

/** Delete a finished session. */
export const deleteSession = (id: number, conn: Conn = db) => conn.execute("DELETE FROM sessions WHERE id = $1 AND open = 0", [id]);

/** Every finished session, oldest first: the CSV export. */
export const allSessions = () => db.select<Session[]>("SELECT * FROM sessions WHERE open = 0 ORDER BY start_ms");

/** A full copy of the database at `path` (SQLite's own consistent snapshot, safe while running). */
export const backupTo = (path: string) => db.execute(`VACUUM INTO '${path.replace(/'/g, "''")}'`);

/* ---------- settings ---------- */

export async function getSettings(): Promise<Settings> {
  const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
  return parseSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

/** Upsert: a row missing from an older or hand-edited database is created, not silently skipped. */
export const setSetting = (key: SettingKey, value: string) =>
  db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
