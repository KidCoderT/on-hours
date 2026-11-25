import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { burstConfetti } from "../lib/confetti";
import { shake } from "./useAlarm";
import { onWindowQueue } from "./useFitWindow";

/** A small, happy wiggle: gentler than the alarm's. */
const WIGGLE = [5, -5, 3, -3, 1, -1, 0];
/** How long the pill's green flash lasts (pill-shell[data-celebrate] in tokens.css). */
const FLASH_MS = 1200;

/**
 * The moment today's goal is met while working: confetti bursts from the pill, the pill wiggles
 * and flashes green. Only on that moment, never when the app opens on a day already done.
 */
export function useCelebrate(done: boolean, running: boolean, ready: boolean) {
  const was = useRef<boolean | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const before = was.current;
    was.current = done;
    if (before !== false || !done || !running) return;
    setOn(true);
    if (isTauri()) {
      burstConfetti().catch((e) => console.error("no confetti", e));
      onWindowQueue(() => shake(WIGGLE)).catch((e) => console.error("no wiggle", e));
    }
  }, [done, running, ready]);
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => setOn(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [on]);
  return on;
}
