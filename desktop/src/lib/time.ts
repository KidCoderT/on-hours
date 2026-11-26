// Work-day maths. Pure functions: no React, no database.

export const HOUR = 3_600_000;
export const WEEK = 7 * 24 * HOUR;

/** The interval a session covers; Session (db.ts) fits this shape. */
type Span = { start_ms: number; end_ms: number };

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** First day of the week containing `d`; weekStart is 0 (Sun) … 6 (Sat). */
export const weekStartOf = (d: Date, weekStart: number) => addDays(startOfDay(d), -((d.getDay() - weekStart + 7) % 7));

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

/**
 * How long the timer has been paused.
 * - Paused earlier today: from that pause. It comes from the database, so a restart keeps the count.
 * - No pause yet today (first launch of the morning, fresh install): from the later of today's
 *   day start and app launch, so opening the app never starts with hours of "idle".
 */
export const holdMs = (now: number, lastPause: number | null, dayFrom: number, launchedAt: number) => {
  const since = lastPause !== null && lastPause >= dayFrom ? lastPause : Math.max(dayFrom, launchedAt);
  return Math.max(0, now - since);
};

/** After the day rolls over with the app open, this long passes before a pause starts to nag. */
export const ROLLOVER_QUIET_MS = 30 * 60_000;

/**
 * The time a pause is judged by (pauseLevel). The pause itself (`pausedMs`, what the pill shows),
 * but counted from no earlier than:
 * - `backAt`: the last return to the PC (unlock, input after an away-length idle, wake from sleep),
 *   so sitting back down starts quiet and never with an instant alarm;
 * - the day start plus ROLLOVER_QUIET_MS, when the pause runs from the day start (app open across it).
 */
export const nagMs = (now: number, pausedMs: number, backAt: number | null, dayFrom: number) => {
  let since = now - pausedMs;
  if (since <= dayFrom) since = dayFrom + ROLLOVER_QUIET_MS;
  if (backAt !== null) since = Math.max(since, backAt);
  return Math.max(0, now - since);
};

/** Time worked inside [from, to): sessions crossing the edges are trimmed, never split. */
export const trimmedTotal = (sessions: Span[], from: number, to: number) =>
  sessions.reduce((sum, s) => sum + Math.max(0, Math.min(s.end_ms, to) - Math.max(s.start_ms, from)), 0);

/** How hard a paused pill nags. "none" while running, "break" during a planned break. */
export type PauseLevel = "none" | "short" | "nudge" | "long" | "alarm" | "break";

/**
 * The pause stages: short, then nudge (5 min by default), long ("Long pause after"), and alarm at
 * "Alarm after" times the long pause (1.5 by default). Once today's goal is met nothing nags: the pause stays short.
 * `done` also covers a quiet day (snoozed, done for today, a rest day). `away`: nobody's at the PC,
 * so the alarm waits at long; it would only shake an empty desk.
 * A planned break never nags. After one, the stages count from the break's end, starting at nudge:
 * the break was the rest, so going over it nags right away, but the break itself is never held against you.
 */
export function pauseLevel(
  p: { running: boolean; done: boolean; pausedMs: number; onBreak: boolean; sinceBreakMs: number | null; away?: boolean },
  s: { nudgeMs: number; longPauseMs: number; alarmFactor: number },
): PauseLevel {
  if (p.running) return "none";
  if (p.onBreak) return "break";
  if (p.done) return "short";
  const ms = p.sinceBreakMs ?? p.pausedMs;
  if (ms >= s.alarmFactor * s.longPauseMs) return p.away ? "long" : "alarm";
  if (ms >= s.longPauseMs) return "long";
  if (ms >= s.nudgeMs || p.sinceBreakMs !== null) return "nudge";
  return "short";
}

/**
 * Is anyone at the PC while the timer runs?
 * - "lock": the session is locked. Pause at the last input, ask nothing.
 * - "pause": no keyboard or mouse for "Pause after". Pause at the last input, ask on return.
 * - "check": no input for "Check in after". The bubble asks "still there?"; the timer keeps running.
 * Either idle setting at 0 is off.
 */
export function awayAction(
  p: { idleMs: number; locked: boolean },
  s: { checkInMs: number; pauseAfterMs: number },
): "lock" | "pause" | "check" | null {
  if (p.locked) return "lock";
  if (s.pauseAfterMs > 0 && p.idleMs >= s.pauseAfterMs) return "pause";
  if (s.checkInMs > 0 && p.idleMs >= s.checkInMs) return "check";
  return null;
}
