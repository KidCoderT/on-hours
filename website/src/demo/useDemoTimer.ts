import { useEffect, useRef, useState } from "react";
import { pauseLevel } from "@app/lib/time";
import type { PillModel } from "@app/themes/types";

export const HOUR = 3_600_000;
const MIN = 60_000;

/** breakLeftMs > 0: on a planned break. afterBreak: the break ran out, so the pause nags from the nudge on.
 * extraMs: today's stretch past the goal (said yes to when the goal was met). */
export type DemoState = { elapsedMs: number; running: boolean; pausedMs: number; breakLeftMs?: number; afterBreak?: boolean; extraMs?: number };

type Options = {
  goalMs?: number;
  longPauseMs?: number;
  showSettingsButton?: boolean;
  /** Only tick while true (off-screen pills stay still). */
  active?: boolean;
};

/**
 * A timer that lives in the browser and speaks the app's PillModel, so the site can render the
 * app's own pill components. Play, pause and breaks work, with the app's own pause stages
 * (lib/time.ts pauseLevel); nothing is saved.
 */
export function useDemoTimer(initial: DemoState, { goalMs = 4 * HOUR, longPauseMs = 20 * MIN, showSettingsButton = true, active = true }: Options = {}) {
  const [state, setState] = useState(initial);
  const last = useRef(0);

  useEffect(() => {
    if (!active) return;
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last.current;
      last.current = now;
      setState((s) => {
        if (s.running) return { ...s, elapsedMs: s.elapsedMs + dt };
        const left = s.breakLeftMs ?? 0;
        if (left > 0 && left <= dt) return { ...s, breakLeftMs: 0, pausedMs: 0, afterBreak: true }; // the break ran out
        return { ...s, breakLeftMs: Math.max(0, left - dt), pausedMs: s.pausedMs + dt };
      });
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  const toggle = () => setState((s) => ({ ...s, running: !s.running, pausedMs: 0, breakLeftMs: 0, afterBreak: false }));
  const takeBreak = (ms: number) => setState((s) => ({ ...s, running: false, pausedMs: 0, breakLeftMs: ms, afterBreak: false }));
  const { elapsedMs, running, pausedMs, breakLeftMs = 0, afterBreak = false, extraMs = 0 } = state;
  const done = elapsedMs >= goalMs;
  const targetMs = goalMs + extraMs;
  const onBreak = !running && breakLeftMs > 0;
  const model: PillModel = {
    elapsedMs,
    goalMs,
    targetMs,
    progress: Math.min(1, elapsedMs / targetMs),
    running,
    done,
    pausedMs,
    breakLeftMs: onBreak ? Math.ceil(breakLeftMs / 1000) * 1000 : 0,
    pause: pauseLevel(
      { running, done, pausedMs, onBreak, sinceBreakMs: afterBreak ? pausedMs : null },
      { nudgeMs: 5 * MIN, longPauseMs, alarmFactor: 1.5 },
    ),
    ready: true,
    showSettingsButton,
    toggle,
    openSettings: () => document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" }),
  };
  return { model, set: setState, toggle, takeBreak };
}
