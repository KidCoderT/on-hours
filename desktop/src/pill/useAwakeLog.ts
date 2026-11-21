import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { markAwake } from "../lib/db";

const EVERY_MS = 30_000;

/**
 * Log when the PC is on and awake, for the history timeline ("PC on 9h, focused 4h"). Runs all
 * the time, running or paused; a sleep or shutdown shows up as a gap. Only the pill window logs.
 */
export function useAwakeLog() {
  useEffect(() => {
    if (!isTauri()) return;
    const mark = () => void markAwake().catch((e) => console.error("could not log PC time", e));
    mark();
    const id = setInterval(mark, EVERY_MS);
    return () => clearInterval(id);
  }, []);
}
