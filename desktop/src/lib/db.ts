import Database from "@tauri-apps/plugin-sql";
import { parseSettings, type SettingKey, type Settings } from "./settings";

// The DB is opened + migrated by Rust at startup (`preload` in tauri.conf.json),
// so every window shares that one connection. File: %APPDATA%\com.tejas.hormozi-timer\hormozi.db
export const db = Database.get("sqlite:hormozi.db");

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

/** Called every ~30s while running, so a crash loses at most that much. */
export const heartbeat = (now = Date.now()) =>
  db.execute("UPDATE sessions SET end_ms = $1 WHERE open = 1", [now]);

export const pauseSession = (now = Date.now()) =>
  db.execute("UPDATE sessions SET end_ms = $1, open = 0 WHERE open = 1", [now]);

/**
 * On launch: a recent open session (reload / quick restart) keeps running and is returned.
 * A stale one (shutdown / crash) is closed at its last heartbeat, so off-time never counts.
 */
export async function recoverOpenSession(staleAfterMs = 2 * 60_000): Promise<Session | null> {
  const [open] = await db.select<Session[]>("SELECT * FROM sessions WHERE open = 1");
  if (!open) return null;
  if (Date.now() - open.end_ms < staleAfterMs) return open;
  await db.execute("UPDATE sessions SET open = 0 WHERE id = $1", [open.id]);
  return null;
}

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
