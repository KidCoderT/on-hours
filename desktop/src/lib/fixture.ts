// Fixed fake state for screenshots (scripts/shots). Only active in a plain browser with
// ?fixture=<state>; the Tauri app never reads this. The harness freezes Date.now, so
// everything here is relative to that frozen "now" and renders identically every run.
import type { Settings } from "./settings";
import { HOUR } from "./time";

const MIN = 60_000;

/** Pill states the harness captures. Elapsed is today's total; pausedMs is time since the last pause. */
export const PILL_STATES = {
  "running-under": { elapsedMs: 1 * HOUR + 12 * MIN + 36_000, running: true, pausedMs: 0 },
  "running-near": { elapsedMs: 3 * HOUR + 41 * MIN + 5_000, running: true, pausedMs: 0 },
  "running-over": { elapsedMs: 4 * HOUR + 37 * MIN + 12_000, running: true, pausedMs: 0 },
  "paused-recent": { elapsedMs: 2 * HOUR + 5 * MIN + 44_000, running: false, pausedMs: 4 * MIN },
  "paused-long": { elapsedMs: 48 * MIN + 10_000, running: false, pausedMs: 2 * HOUR + 50 * MIN },
} as const;
export type PillState = keyof typeof PILL_STATES;

const params = new URLSearchParams(location.search);
const param = params.get("fixture");
export const fixture: (typeof PILL_STATES)[PillState] | null =
  param && param in PILL_STATES ? PILL_STATES[param as PillState] : param ? PILL_STATES["running-under"] : null;

/** Settings the harness pins through the URL: ?theme=<id>&button=0|1. Empty outside fixture mode. */
export const fixtureSettings: Partial<Settings> = fixture
  ? {
      ...(params.get("theme") && { pillTheme: params.get("theme")! }),
      ...(params.get("button") && { pillSettingsButton: params.get("button") !== "0" }),
    }
  : {};

/**
 * Two weeks of sessions ending at the frozen now (a Wednesday afternoon in the harness).
 * Deliberately uneven so the chart shows met, missed, and empty days.
 */
export function fixtureSessions(now: number) {
  const day = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const at = (daysAgo: number, h: number, m = 0) => day(daysAgo) + h * HOUR + m * MIN;
  // [daysAgo, startHour, startMin, lengthMin]
  const blocks: [number, number, number, number][] = [
    [9, 9, 0, 150], [9, 14, 0, 100],
    [8, 10, 30, 120], [8, 15, 0, 160],
    [7, 9, 15, 75],
    [6, 8, 0, 180], [6, 13, 30, 90], [6, 19, 0, 50],
    [5, 9, 0, 240], [5, 15, 30, 45],
    [3, 7, 45, 135], [3, 12, 0, 120], [3, 16, 0, 40],
    [2, 9, 30, 110], [2, 14, 0, 50],
    [1, 10, 0, 240], [1, 16, 0, 70],
    [0, 9, 0, 95], [0, 11, 30, 120],
  ];
  return blocks.map(([d, h, m, len], i) => ({ id: i + 1, start_ms: at(d, h, m), end_ms: at(d, h, m) + len * MIN, open: 0 }));
}
