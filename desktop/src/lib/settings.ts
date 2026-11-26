// Settings shape, defaults, and parsing. Pure: no Tauri, no DB, so it is unit-tested.

/**
 * hotkey: global pause/resume combo, "" = off (see lib/hotkey.ts). weekStart: 0 = Sunday … 6 = Saturday. showInRecordings: false hides the pill from screen capture.
 * pillTheme is a theme id; unknown ids fall back to the default theme in themes/registry.ts.
 */
export type Settings = {
  dailyGoalMs: number;
  dayStart: string;
  weekStart: number;
  showInRecordings: boolean;
  pillTheme: string;
  pillSettingsButton: boolean;
  longPauseMs: number;
  nudgeMs: number;
  alarmFactor: number; // the alarm comes at this many long pauses
  checkInMs: number; // no input this long while running: the bubble asks "still there?". 0 = off
  pauseAfterMs: number; // no input this long while running: pause at the last input. 0 = off
  stretchMs: number; // goal met while working: offer to push this much more today. 0 = never ask
  hotkey: string;
};

export type SettingKey =
  | "daily_goal_min"
  | "day_start"
  | "week_start"
  | "show_in_recordings"
  | "pill_theme"
  | "pill_settings_button"
  | "long_pause_min"
  | "nudge_min"
  | "alarm_factor"
  | "check_in_min"
  | "pause_after_min"
  | "stretch_min"
  | "hotkey";

const MIN = 60_000;

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMs: 240 * MIN,
  dayStart: "00:00",
  weekStart: 1,
  showInRecordings: true,
  pillTheme: "baseline",
  pillSettingsButton: true,
  longPauseMs: 20 * MIN,
  nudgeMs: 5 * MIN,
  alarmFactor: 1.5,
  checkInMs: 10 * MIN,
  pauseAfterMs: 20 * MIN,
  stretchMs: 30 * MIN,
  hotkey: "Ctrl+Alt+Shift+O",
};

/** Accepted range for the long-pause threshold, in minutes. */
export const LONG_PAUSE_MIN = { min: 5, max: 240 };

/**
 * When a pause starts to nudge, in minutes. No Settings row yet: a missing `nudge_min` row means
 * the default. To make it a setting, add a row to DailyRhythm (SettingsWindow.tsx) that saves
 * `nudge_min`, like "Long pause after".
 */
export const NUDGE_MIN = { min: 1, max: 240 };

/** Accepted range for the alarm, in long pauses: always after the long pause, at most 5 of them. */
export const ALARM_FACTOR = { min: 1.25, max: 5 };

/** Accepted ranges for the idle settings, in minutes. 0 turns either off. "Pause after" must come later. */
export const CHECK_IN_MIN = { min: 2, max: 60 };
export const PAUSE_AFTER_MIN = { min: 5, max: 120 };
/** Accepted range for "Stretch by", in minutes. 0 turns the question off. */
export const STRETCH_MIN = { min: 5, max: 120 };
/** A whole number of minutes in range, or 0 (off), or the fallback. */
const minutesOrOff = (raw: string | undefined, r: { min: number; max: number }, fallback: number) =>
  raw?.trim() === "0" ? 0 : int(raw, r.min, r.max, fallback / MIN) * MIN;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A whole number in [min, max], or the fallback. Rejects "", NaN, Infinity, and out-of-range values. */
const int = (raw: string | undefined, min: number, max: number, fallback: number) => {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** A number in [min, max], or the fallback. Rejects "", NaN and Infinity. */
const num = (raw: string | undefined, min: number, max: number, fallback: number) => {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/**
 * Settings rows (key → value) to a valid Settings object. A missing or malformed row
 * never reaches the timer: it becomes the default for that field.
 */
export function parseSettings(rows: Record<string, string | undefined>): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    dailyGoalMs: int(rows.daily_goal_min, 1, 24 * 60, d.dailyGoalMs / MIN) * MIN,
    dayStart: rows.day_start && HHMM.test(rows.day_start) ? rows.day_start : d.dayStart,
    weekStart: int(rows.week_start, 0, 6, d.weekStart),
    showInRecordings: rows.show_in_recordings !== "0",
    pillTheme: rows.pill_theme?.trim() || d.pillTheme,
    pillSettingsButton: rows.pill_settings_button !== "0",
    longPauseMs: int(rows.long_pause_min, LONG_PAUSE_MIN.min, LONG_PAUSE_MIN.max, d.longPauseMs / MIN) * MIN,
    nudgeMs: int(rows.nudge_min, NUDGE_MIN.min, NUDGE_MIN.max, d.nudgeMs / MIN) * MIN,
    alarmFactor: num(rows.alarm_factor, ALARM_FACTOR.min, ALARM_FACTOR.max, d.alarmFactor),
    checkInMs: minutesOrOff(rows.check_in_min, CHECK_IN_MIN, d.checkInMs),
    pauseAfterMs: minutesOrOff(rows.pause_after_min, PAUSE_AFTER_MIN, d.pauseAfterMs),
    stretchMs: minutesOrOff(rows.stretch_min, STRETCH_MIN, d.stretchMs),
    hotkey: rows.hotkey === undefined ? d.hotkey : rows.hotkey.trim(), // a saved "" means the user turned it off
  };
}
