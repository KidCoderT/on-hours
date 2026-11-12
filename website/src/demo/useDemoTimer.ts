import { useEffect, useRef, useState } from "react";
import type { PillModel } from "@app/themes/types";

export const HOUR = 3_600_000;
const MIN = 60_000;

export type DemoState = { elapsedMs: number; running: boolean; pausedMs: number };

type Options = {
  goalMs?: number;
  longPauseMs?: number;
  showSettingsButton?: boolean;
  /** Only tick while true (off-screen pills stay still). */
  active?: boolean;
};

/**
 * A timer that lives in the browser and speaks the app's PillModel, so the site can render the
 * app's own pill components. Play and pause work; nothing is saved.
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
      setState((s) => (s.running ? { ...s, elapsedMs: s.elapsedMs + dt } : { ...s, pausedMs: s.pausedMs + dt }));
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  const toggle = () => setState((s) => ({ ...s, running: !s.running, pausedMs: 0 }));
  const { elapsedMs, running, pausedMs } = state;
  const model: PillModel = {
    elapsedMs,
    goalMs,
    progress: Math.min(1, elapsedMs / goalMs),
    running,
    done: elapsedMs >= goalMs,
    pausedMs,
    pause: running ? "none" : pausedMs >= longPauseMs ? "long" : "short",
    ready: true,
    showSettingsButton,
    toggle,
    openSettings: () => document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" }),
  };
  return { model, set: setState, toggle };
}
