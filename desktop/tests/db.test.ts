// Run: bun test   (checks the migration SQL and the day/trim math without Tauri)
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { expect, test } from "bun:test";
import { MIN_SESSION_MS, pauseSession, STALE_MS, touchOpen, type Session } from "../src/lib/db";
import { DEFAULT_SETTINGS, parseSettings } from "../src/lib/settings";
import { dayRange, holdMs, trimmedTotal, weekStartOf, workDayOf } from "../src/lib/time";

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
