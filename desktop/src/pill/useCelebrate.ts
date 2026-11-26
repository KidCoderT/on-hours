import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { burstConfetti } from "../lib/confetti";
import { calm, shake } from "./useAlarm";
import { onWindowQueue } from "./useFitWindow";

/** A small, happy wiggle: gentler than the alarm's. */
const WIGGLE = [5, -5, 3, -3, 1, -1, 0];
/** How long the pill's green flash lasts (pill-shell[data-celebrate] in tokens.css). */
const FLASH_MS = 1200;

/**
 * The moment today's target (the goal, then each stretch) is met while working: confetti bursts
 * from the pill, the pill wiggles and flashes green. Only on that moment, never when the app opens
 * on a day already met, or when the target moves (a goal changed in settings, a stretch).
 * `ready`: today's total is loaded, so a jump in it is real time.
 */
export function useCelebrate(elapsed: number, target: number, running: boolean, ready: boolean) {
  const done = elapsed >= target;
  const was = useRef<{ done: boolean; target: number } | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const before = was.current;
    was.current = { done, target };
    if (before?.done !== false || before.target !== target || !done || !running) return;
    setOn(true);
    if (isTauri() && !calm()) { // reduced motion: the flash's CSS is off too, so the moment is the screen reader's
      burstConfetti().catch((e) => console.error("no confetti", e));
      onWindowQueue(() => shake(WIGGLE)).catch((e) => console.error("no wiggle", e));
    }
  }, [done, target, running, ready]);
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => setOn(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [on]);
  return on;
}
