// Run: bun test   (checks the migration SQL and the day/trim math without Tauri)
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { expect, test } from "bun:test";
import { addExtra, clearExtra, endBreak, extraFor, markAwake, MIN_SESSION_MS, pauseSession, recoverOpenSession, reopenSession, STALE_MS, startBreak, touchOpen, type Session } from "../src/lib/db";
import { DEFAULT_SETTINGS, parseSettings } from "../src/lib/settings";
import { awayAction, dayRange, holdMs, nagMs, pauseLevel, stretchAdd, ROLLOVER_QUIET_MS, trimmedTotal, weekStartOf, workDayOf } from "../src/lib/time";

const H = 3_600_000;
const s = (start: number, end: number): Session => ({ id: 0, start_ms: start, end_ms: end, open: 0 });

test("migration creates tables, defaults, and allows only one open session", async () => {
  const db = new Database(":memory:");
  // Apply every migration file in order (0001, 0002, …), like the app does on startup.
  const dir = new URL("../src-tauri/migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(await Bun.file(new URL(f, dir)).text());
  }
  expect(db.query("SELECT value FROM settings WHERE key = 'week_start'").get()).toEqual({ value: "1" });
  expect(db.query("SELECT value FROM settings WHERE key = 'show_in_recordings'").get()).toEqual({ value: "1" });
  expect(db.query("SELECT value FROM settings WHERE key = 'daily_goal_min'").get()).toEqual({ value: "240" });
  db.run("INSERT INTO sessions (start_ms, end_ms) VALUES (1, 1)");
  expect(() => db.run("INSERT INTO sessions (start_ms, end_ms) VALUES (2, 2)")).toThrow();
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (3, 4, 0)"); // closed ones are fine
});

test("sessions crossing the day boundary are trimmed to each day", () => {
  const mon = dayRange(new Date(2026, 10, 2), "00:00");
  const tue = dayRange(new Date(2026, 10, 3), "00:00");
  const lateNight = s(mon.to - 1 * H, mon.to + 2 * H); // 23:00 → 02:00
  expect(trimmedTotal([lateNight], mon.from, mon.to)).toBe(1 * H);
  expect(trimmedTotal([lateNight], tue.from, tue.to)).toBe(2 * H);
  expect(trimmedTotal([s(0, 1)], mon.from, mon.to)).toBe(0); // outside → 0, never negative
});

test("day start shifts which day a moment belongs to", () => {
  const twoAm = new Date(2026, 10, 3, 2, 0);
  expect(workDayOf(twoAm, "04:00").getDate()).toBe(2); // before 04:00 → still Monday
  expect(workDayOf(twoAm, "00:00").getDate()).toBe(3);
  const r = dayRange(new Date(2026, 10, 2), "04:00");
  expect(r.to - r.from).toBe(24 * H);
  expect(new Date(r.from).getHours()).toBe(4);
});

test("week start picks the first day of the week", () => {
  const wed = new Date(2026, 10, 4); // Wed 4 Nov 2026
  expect(weekStartOf(wed, 1).getDate()).toBe(2); // Monday
  expect(weekStartOf(wed, 0).getDate()).toBe(1); // Sunday
  expect(weekStartOf(wed, 3).getDate()).toBe(4); // Wednesday itself
  expect(weekStartOf(wed, 6).getDate()).toBe(31); // Saturday 31 Oct
});

/* ---------- migrations + settings ---------- */

const migrationsDir = new URL("../src-tauri/migrations/", import.meta.url);
const migrationFiles = () => readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const migrate = async (db: Database, files: string[]) => {
  for (const f of files) db.exec(await Bun.file(new URL(f, migrationsDir)).text());
};
const rowsOf = (db: Database) =>
  Object.fromEntries((db.query("SELECT key, value FROM settings").all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
// Same statement as setSetting in src/lib/db.ts.
const UPSERT = "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value";

test("a fresh database parses to exactly the app defaults", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  expect(parseSettings(rowsOf(db))).toEqual(DEFAULT_SETTINGS);
});

test("upgrading keeps the user's settings and sessions, and adds the pill settings", async () => {
  const db = new Database(":memory:");
  const files = migrationFiles();
  await migrate(db, files.filter((f) => f < "0004"));
  db.run(UPSERT, ["daily_goal_min", "90"]);
  db.run(UPSERT, ["day_start", "04:00"]);
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (10, 20, 0)");
  await migrate(db, files.filter((f) => f >= "0004"));
  const s = parseSettings(rowsOf(db));
  expect(s.dailyGoalMs).toBe(90 * 60_000);
  expect(s.dayStart).toBe("04:00");
  expect(s.pillTheme).toBe("baseline");
  expect(s.pillSettingsButton).toBe(true);
  expect(s.longPauseMs).toBe(20 * 60_000);
  expect(db.query("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
});

test("saving a setting creates its row when an old database lacks it", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles().filter((f) => f < "0004"));
  db.run(UPSERT, ["pill_theme", "ledger"]);
  db.run(UPSERT, ["pill_theme", "instrument"]);
  expect(parseSettings(rowsOf(db)).pillTheme).toBe("instrument");
});

test("malformed settings rows fall back to defaults instead of breaking the timer", () => {
  const s = parseSettings({
    daily_goal_min: "abc",
    day_start: "25:99",
    week_start: "9",
    long_pause_min: "1.5",
    pill_theme: "  ",
  });
  expect(s).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings({ daily_goal_min: "", long_pause_min: "100000" })).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings({}).dayStart).toBe("00:00"); // a missing row can't reach dayStart.split()
  expect(parseSettings({ day_start: "07:30", long_pause_min: "45", pill_settings_button: "0" })).toMatchObject({
    dayStart: "07:30",
    longPauseMs: 45 * 60_000,
    pillSettingsButton: false,
  });
});

/* ---------- hold time ---------- */

test("hold time: today's pause survives a restart; a new day or fresh install starts quiet", () => {
  const day = new Date(2026, 10, 4).getTime(); // work-day starts at 00:00
  const now = day + 9 * H;
  const launchedNow = now - 60_000; // app opened a minute ago
  // Paused at 08:30 today, app restarted at 08:59: still 30 minutes (the pause comes from the DB).
  expect(holdMs(now, day + 8.5 * H, day, launchedNow)).toBe(0.5 * H);
  // Morning launch after yesterday's last session: counts from launch, not from midnight.
  expect(holdMs(now, day - 4 * H, day, launchedNow)).toBe(60_000);
  // Fresh install, nothing ever logged: same.
  expect(holdMs(now, null, day, launchedNow)).toBe(60_000);
  // App left open overnight: counts from the day start, not from yesterday's pause.
  expect(holdMs(now, day - 4 * H, day, day - 10 * H)).toBe(9 * H);
  // A pause stamped after now (clock moved back) never goes negative.
  expect(holdMs(now, now + H, day, launchedNow)).toBe(0);
});

/* ---------- session writes ---------- */

// The app's DB functions, run against bun:sqlite instead of the Tauri plugin.
const conn = (db: Database) => ({
  execute: async (sql: string, args: unknown[] = []) => ({ rowsAffected: db.query(sql).run(...(args as number[])).changes, lastInsertId: 0 }),
});
const only = (db: Database) => db.query("SELECT start_ms, end_ms, open FROM sessions").get();

test("sleeping with the timer on never counts: the session closes at its last heartbeat", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = conn(db) as never;
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (0, 0, 1)");
  expect(await touchOpen(30_000, false, c)).toBe(true); // a normal heartbeat
  expect(only(db)).toEqual({ start_ms: 0, end_ms: 30_000, open: 1 });
  // Woken 8h later: the heartbeat (or a pause) finds it stale and closes it at 30s.
  expect(await touchOpen(8 * H, false, c)).toBe(false);
  expect(only(db)).toEqual({ start_ms: 0, end_ms: 30_000, open: 0 });

  db.run("DELETE FROM sessions");
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (0, 0, 1)");
  expect(await touchOpen(8 * H, true, c)).toBe(false); // pausing right after wake
  expect(only(db)).toEqual({ start_ms: 0, end_ms: 0, open: 0 });

  db.run("DELETE FROM sessions");
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (0, 0, 1)");
  expect(await touchOpen(STALE_MS - 1, true, c)).toBe(true); // an ordinary pause
  expect(only(db)).toEqual({ start_ms: 0, end_ms: STALE_MS - 1, open: 0 });
});

test("pausing a misclick (under 5s) drops it; real sessions are kept", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = conn(db) as never;
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (0, 60000, 0)"); // earlier, closed
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (100000, 100000, 1)");
  expect(await pauseSession(100000 + MIN_SESSION_MS - 1, c)).toBe(true);
  expect(db.query("SELECT start_ms FROM sessions").all()).toEqual([{ start_ms: 0 }]);
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (200000, 200000, 1)");
  await pauseSession(200000 + MIN_SESSION_MS, c);
  expect(db.query("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 2 });
});

test("a session resumed after a quick restart keeps running past its first heartbeat", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = { ...conn(db), select: async (sql: string) => db.query(sql).all() } as never;
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (0, 0, 1)");
  const relaunch = 100_000; // 100s after the last heartbeat: under STALE_MS, so it resumes
  expect(await recoverOpenSession(relaunch, c)).not.toBeNull();
  expect(await touchOpen(relaunch + 30_000, false, c)).toBe(true); // the first heartbeat after it
  expect(only(db)).toEqual({ start_ms: 0, end_ms: relaunch + 30_000, open: 1 });
});

test("pause stages: short, nudge at 5 min, long at the setting, alarm at 1.5 times it", () => {
  const M = 60_000;
  const s = { nudgeMs: 5 * M, longPauseMs: 20 * M, alarmFactor: 1.5 };
  const p = { running: false, done: false, pausedMs: 0, onBreak: false, sinceBreakMs: null };
  const at = (min: number, done = false) => pauseLevel({ ...p, done, pausedMs: min * M }, s);
  expect(pauseLevel({ ...p, running: true }, s)).toBe("none");
  expect([at(0), at(4.9), at(5), at(19.9), at(20), at(29.9), at(30)]).toEqual(["short", "short", "nudge", "nudge", "long", "long", "alarm"]);
  expect(pauseLevel({ ...p, pausedMs: 39 * M }, { ...s, alarmFactor: 2 })).toBe("long"); // "Alarm after" moves it
  expect(at(90, true)).toBe("short"); // goal met: nothing nags
  // Long pause set to the 5 min minimum: nudge never shows, long and alarm still come in order.
  const tight = { nudgeMs: 5 * M, longPauseMs: 5 * M, alarmFactor: 2 };
  expect(pauseLevel({ ...p, pausedMs: 5 * M }, tight)).toBe("long");
  expect(pauseLevel({ ...p, pausedMs: 10 * M }, tight)).toBe("alarm");
  // A break never nags, goal met or not. After it the stages restart from its end, at nudge.
  expect(pauseLevel({ ...p, pausedMs: 90 * M, onBreak: true }, s)).toBe("break");
  expect(pauseLevel({ ...p, pausedMs: 46 * M, sinceBreakMs: 1 * M }, s)).toBe("nudge"); // 45 min break, 1 min over
  expect(pauseLevel({ ...p, pausedMs: 66 * M, sinceBreakMs: 21 * M }, s)).toBe("long");
  expect(pauseLevel({ ...p, pausedMs: 66 * M, sinceBreakMs: 21 * M, done: true }, s)).toBe("short");
  // A nudge_min row (a future setting) is read; nonsense falls back to 5.
  expect(parseSettings({ nudge_min: "8" }).nudgeMs).toBe(8 * M);
  expect(parseSettings({ nudge_min: "0" }).nudgeMs).toBe(5 * M);
  expect(parseSettings({ alarm_factor: "2.5" }).alarmFactor).toBe(2.5);
  expect(["1", "9", "x", ""].map((v) => parseSettings({ alarm_factor: v }).alarmFactor)).toEqual([1.5, 1.5, 1.5, 1.5]);
});

test("breaks: a new one ends the running one, ending early stamps now, ending none does nothing", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = conn(db);
  const M = 60_000;
  await startBreak(0, 15 * M, c);
  await startBreak(5 * M, 30 * M, c); // picked 30 min while on the 15: the first one ends at 5
  await endBreak(20 * M, c); // back early
  await endBreak(60 * M, c); // nothing running
  expect(db.query("SELECT start_ms, end_ms FROM breaks ORDER BY id").all()).toEqual([
    { start_ms: 0, end_ms: 5 * M },
    { start_ms: 5 * M, end_ms: 20 * M },
  ]);
});

test("PC on: heartbeats extend one stretch; a sleep, shutdown or clock change starts another", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = conn(db);
  for (const t of [0, 30_000, 60_000]) await markAwake(t, c);
  await markAwake(60_000 + STALE_MS, c); // slept 2 min: new stretch
  await markAwake(60_000 + STALE_MS + 30_000, c);
  await markAwake(10_000, c); // clock set back: never stretch backwards
  expect(db.query("SELECT start_ms, end_ms FROM awake ORDER BY id").all()).toEqual([
    { start_ms: 0, end_ms: 60_000 },
    { start_ms: 60_000 + STALE_MS, end_ms: 90_000 + STALE_MS },
    { start_ms: 10_000, end_ms: 10_000 },
  ]);
});

test("away: a lock pauses; idle checks in, then pauses later; 0 turns either stage off", () => {
  const M = 60_000;
  const s = { checkInMs: 10 * M, pauseAfterMs: 20 * M };
  const at = (min: number, settings = s) => awayAction({ idleMs: min * M, locked: false }, settings);
  expect(awayAction({ idleMs: 0, locked: true }, s)).toBe("lock");
  expect(awayAction({ idleMs: 0, locked: true }, { checkInMs: 0, pauseAfterMs: 0 })).toBe("lock");
  expect([at(9.9), at(10), at(19.9), at(20), at(90)]).toEqual([null, "check", "check", "pause", "pause"]);
  expect(at(30, { checkInMs: 0, pauseAfterMs: 20 * M })).toBe("pause"); // no check-in, still pauses
  expect(at(30, { checkInMs: 10 * M, pauseAfterMs: 0 })).toBe("check"); // never pauses, keeps asking
  expect(at(99, { checkInMs: 0, pauseAfterMs: 0 })).toBe(null);
  expect(parseSettings({})).toMatchObject({ checkInMs: 10 * M, pauseAfterMs: 20 * M });
  expect(parseSettings({ check_in_min: "0", pause_after_min: "0" })).toMatchObject({ checkInMs: 0, pauseAfterMs: 0 });
  expect(parseSettings({ check_in_min: "15", pause_after_min: "45" })).toMatchObject({ checkInMs: 15 * M, pauseAfterMs: 45 * M });
  // Out of range or not whole minutes: the default.
  expect(["1", "61", "2.5", "x"].map((v) => parseSettings({ check_in_min: v }).checkInMs)).toEqual([10 * M, 10 * M, 10 * M, 10 * M]);
  expect(["4", "121", "x"].map((v) => parseSettings({ pause_after_min: v }).pauseAfterMs)).toEqual([20 * M, 20 * M, 20 * M]);
});

test("away, then \"it was work\": the session reopens at now, but only if nothing happened since", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = conn(db);
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (0, 600000, 0)"); // closed by an away-pause at 10 min
  expect(await reopenSession(1, 600_000, 1_500_000, c)).toBe(true);
  expect(only(db)).toEqual({ start_ms: 0, end_ms: 1_500_000, open: 1 }); // fresh for the first heartbeat
  expect(await reopenSession(1, 600_000, 1_600_000, c)).toBe(false); // asked twice: no-op
  db.run("UPDATE sessions SET open = 0");
  db.run("INSERT INTO sessions (start_ms, end_ms, open) VALUES (1700000, 1700000, 1)"); // pressed play before answering
  expect(await reopenSession(1, 1_500_000, 1_800_000, c)).toBe(false);
});

test("a stretch adds to one day's goal only, and adds up when said yes again", async () => {
  const db = new Database(":memory:");
  await migrate(db, migrationFiles());
  const c = { ...conn(db), select: async (sql: string, args: unknown[] = []) => db.query(sql).all(...(args as number[])) } as never;
  const mon = dayRange(new Date(2026, 10, 2), "00:00").from;
  const tue = dayRange(new Date(2026, 10, 3), "00:00").from;
  expect(await extraFor(mon, c)).toBe(0);
  await addExtra(mon, 30 * 60_000, c);
  await addExtra(mon, 30 * 60_000, c); // met the stretch, said yes again
  expect(await extraFor(mon, c)).toBe(60 * 60_000);
  expect(await extraFor(tue, c)).toBe(0); // the next day starts from the plain goal
  await addExtra(tue, 30 * 60_000, c);
  await clearExtra(mon, c); // the goal changed: only that day's stretch goes
  expect([await extraFor(mon, c), await extraFor(tue, c)]).toEqual([0, 30 * 60_000]);
});

test("\"Stretch by\": 30 min by default, 0 turns the question off, out of range falls back", () => {
  const M = 60_000;
  expect(parseSettings({}).stretchMs).toBe(30 * M);
  expect(parseSettings({ stretch_min: "0" }).stretchMs).toBe(0);
  expect(parseSettings({ stretch_min: "45" }).stretchMs).toBe(45 * M);
  expect(["4", "121", "2.5", "x"].map((v) => parseSettings({ stretch_min: v }).stretchMs)).toEqual([30 * M, 30 * M, 30 * M, 30 * M]);
});

test("nag clock: a return to the PC or a new day starts the stages over; the pause itself is untouched", () => {
  const day = new Date(2026, 10, 4).getTime();
  const now = day + 9 * H;
  expect(nagMs(now, H, null, day)).toBe(H); // a plain pause
  expect(nagMs(now, H, now - 60_000, day)).toBe(60_000); // back a minute ago: judged from the return
  expect(nagMs(now, H, now - 2 * H, day)).toBe(H); // a return before the pause changes nothing
  // App open across the day start, no pause yet today: quiet for the first half hour.
  expect(nagMs(day + 20 * 60_000, 20 * 60_000, null, day)).toBe(0);
  expect(nagMs(day + 9 * H, 9 * H, null, day)).toBe(9 * H - ROLLOVER_QUIET_MS);
  expect(nagMs(day + 9 * H, 9 * H, day + 8.9 * H, day)).toBeCloseTo(0.1 * H); // back this morning: from then
});

test("pause stages: quiet days never nag, and nobody at the PC holds the alarm at long", () => {
  const M = 60_000;
  const s = { nudgeMs: 5 * M, longPauseMs: 20 * M, alarmFactor: 1.5 };
  const p = { running: false, done: false, pausedMs: 90 * M, onBreak: false, sinceBreakMs: null };
  expect(pauseLevel(p, s)).toBe("alarm");
  expect(pauseLevel({ ...p, away: true }, s)).toBe("long");
  expect(pauseLevel({ ...p, away: true, pausedMs: 21 * M }, s)).toBe("long");
  expect(pauseLevel({ ...p, away: true, pausedMs: 6 * M }, s)).toBe("nudge");
});

test("rest days and quiet-until parse; junk is dropped", () => {
  expect(parseSettings({}).restDays).toEqual([]);
  expect(parseSettings({ rest_days: "6,0,6, 3,x,9," }).restDays).toEqual([0, 3, 6]);
  expect(parseSettings({ quiet_until: "1764000000000" }).quietUntil).toBe(1764000000000);
  expect(parseSettings({ quiet_until: "-5" }).quietUntil).toBe(0);
  expect(parseSettings({ quiet_until: "soon" }).quietUntil).toBe(0);
});

test("push more: 30 past the target, or 30 past now once beyond it", () => {
  const M = 60_000;
  expect(stretchAdd(240 * M, 240 * M, 30 * M)).toBe(30 * M); // the moment the goal is met
  expect(stretchAdd(250 * M, 240 * M, 30 * M)).toBe(40 * M); // 10 min past: target ends 30 min from now
  expect(stretchAdd(200 * M, 270 * M, 30 * M)).toBe(30 * M); // mid-stretch: 30 more on top
});
