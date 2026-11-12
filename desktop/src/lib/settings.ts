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
  hotkey: "Ctrl+Alt+Shift+O",
};

/** Accepted range for the long-pause threshold, in minutes. */
export const LONG_PAUSE_MIN = { min: 5, max: 240 };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A whole number in [min, max], or the fallback. Rejects "", NaN, Infinity, and out-of-range values. */
const int = (raw: string | undefined, min: number, max: number, fallback: number) => {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
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
    hotkey: rows.hotkey === undefined ? d.hotkey : rows.hotkey.trim(), // a saved "" means the user turned it off
  };
}
