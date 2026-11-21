// The away bubble: a small window that rises above the pill to ask "still there?" and the like.
// The pill window owns the timer, so it decides what the bubble says (pill/useTimer.ts) and places
// it; the bubble window (windows/bubble/BubbleWindow.tsx) only draws, animates and answers.
import { emitTo } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, PhysicalPosition, Window } from "@tauri-apps/api/window";

/** check: "still there?" (timer running). paused: away long enough to pause. count: back, count it? */
export type BubbleKind = "check" | "paused" | "count";
export type BubbleShow = { kind: BubbleKind; title: string; sub?: string; theme: string; below: boolean };
export type BubbleAnswer = { kind: BubbleKind; yes: boolean };
/** drop: answered, falls back toward the pill. quiet: they came back without answering, fades after a beat. */
export type BubbleHide = { how: "drop" | "quiet" };

export const SHOW = "bubble-show";
export const HIDE = "bubble-hide";
export const ANSWER = "bubble-answer";

/** Bubble window size in CSS px, as in tauri.conf.json. */
const W = 272;
const H = 124;
/** How far in from the pill's right edge the bubble's tail points: about over the play button. */
const ALIGN_RIGHT = 8;

/**
 * Put the bubble above the pill, right edges lined up, inside the screen. When there's no room above
 * (the pill sits at the top of the screen), it goes below and points up. Returns which it chose.
 */
export async function placeBubble() {
  const pill = getCurrentWindow();
  const bubble = await Window.getByLabel("bubble");
  if (!bubble) return false;
  const [pos, size, scale, monitor] = await Promise.all([pill.outerPosition(), pill.outerSize(), pill.scaleFactor(), currentMonitor()]);
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const area = monitor?.workArea;
  const below = !!area && pos.y - h < area.position.y;
  let x = pos.x + size.width - w + Math.round(ALIGN_RIGHT * scale);
  if (area) x = Math.min(Math.max(x, area.position.x), area.position.x + area.size.width - w);
  await bubble.setPosition(new PhysicalPosition(x, below ? pos.y + size.height : pos.y - h));
  return below;
}

export async function showBubble(b: Omit<BubbleShow, "below">) {
  const below = await placeBubble();
  const bubble = await Window.getByLabel("bubble");
  // Show the (empty, transparent) window first, then fill it, so the rise plays where it can be seen.
  await bubble?.show(); // not focusable (tauri.conf.json): showing it never takes the keyboard
  await emitTo("bubble", SHOW, { ...b, below } satisfies BubbleShow);
}

export const hideBubble = (how: BubbleHide["how"]) => emitTo("bubble", HIDE, { how } satisfies BubbleHide);
