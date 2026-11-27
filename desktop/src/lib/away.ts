// The away bubbles' state machine, pure so it is unit-tested. useTimer.ts runs it every 2s and
// carries out what it returns (closing the session, showing or hiding the bubble).
import { awayAction } from "./time";

/** Idle under this after an away-pause: they're back, so ask. */
export const BACK_MS = 3_000;
/** "Welcome back" and "push some more?" wait this long for an answer, then go: a No. */
export const ANSWER_WAIT_MS = 60_000;

export type BubbleKind = "check" | "paused" | "count" | "stretch";
export type AwayEffect =
  | { do: "hide"; how: "quiet" | "drop" } // quiet: it fades, the answer doesn't matter; drop: a No
  | { do: "pause"; at: number } // close the running session at the last input, then say "Paused."
  | { do: "check"; from: number } // "Hey, you still there?"
  | { do: "count" }; // the "Paused." bubble becomes "Welcome back": Count it / Start now

/**
 * One look at the PC. `gone`: paused and nobody here: locked, or idle as long as an auto-pause
 * takes or as a long pause, whichever is sooner (a short idle isn't away, reading while paused is
 * what the nagging is for). The alarm comes after a long pause, so it never finds an idle desk.
 * Running: lock or "Pause after" pauses at the last input; "Check in after" asks; input back
 * before an answer fades the question (the time counts). Paused: back at the PC turns "Paused."
 * into "Welcome back". Unanswered questions go after ANSWER_WAIT_MS.
 */
export function awayStep(
  p: { running: boolean; bubble: { kind: BubbleKind; shownAt: number } | null; idleMs: number; locked: boolean; now: number },
  s: { checkInMs: number; pauseAfterMs: number; longPauseMs: number },
): { gone: boolean; fx: AwayEffect[] } {
  const b = p.bubble;
  const fx: AwayEffect[] = [];
  const emptyMs = s.pauseAfterMs > 0 ? Math.min(s.pauseAfterMs, s.longPauseMs) : s.longPauseMs;
  const gone = !p.running && (p.locked || p.idleMs >= emptyMs);
  if (b?.kind === "stretch" && p.now - b.shownAt > ANSWER_WAIT_MS) fx.push({ do: "hide", how: "quiet" }); // not today
  if (p.running) {
    const action = awayAction({ idleMs: p.idleMs, locked: p.locked }, s);
    const at = p.now - p.idleMs;
    if (action === "lock" || action === "pause") fx.push({ do: "pause", at });
    else if (action === "check" && !b) fx.push({ do: "check", from: at });
    else if (!action && b?.kind === "check") fx.push({ do: "hide", how: "quiet" });
  } else {
    if (b?.kind === "paused" && !p.locked && p.idleMs < BACK_MS) fx.push({ do: "count" });
    if (b?.kind === "count" && p.now - b.shownAt > ANSWER_WAIT_MS) fx.push({ do: "hide", how: "drop" });
  }
  return { gone, fx };
}
