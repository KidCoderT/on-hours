// Work-day maths. Pure functions: no React, no database.

export const HOUR = 3_600_000;
export const WEEK = 7 * 24 * HOUR;

/** The interval a session covers; Session (db.ts) fits this shape. */
type Span = { start_ms: number; end_ms: number };

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

const at = (d: Date, dayStart: string, plusDays = 0) => {
  const [h, m] = dayStart.split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + plusDays, h, m).getTime();
};

/** The work-day labelled with `day`'s date, e.g. day-start 04:00 → [Mon 04:00, Tue 04:00). */
export const dayRange = (day: Date, dayStart: string) => ({
  from: at(day, dayStart),
  to: at(day, dayStart, 1),
});

/** Which work-day `now` belongs to: before the day-start time still counts as yesterday. */
export const workDayOf = (now: Date, dayStart: string) =>
  now.getTime() < at(now, dayStart) ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;

/** Time worked inside [from, to): sessions crossing the edges are trimmed, never split. */
export const trimmedTotal = (sessions: Span[], from: number, to: number) =>
  sessions.reduce((sum, s) => sum + Math.max(0, Math.min(s.end_ms, to) - Math.max(s.start_ms, from)), 0);
