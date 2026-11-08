// Run: bun test   (checks the migration SQL and the day/trim math without Tauri)
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { expect, test } from "bun:test";
import type { Session } from "../src/lib/db";
import { dayRange, trimmedTotal, weekStartOf, workDayOf } from "../src/lib/time";

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
