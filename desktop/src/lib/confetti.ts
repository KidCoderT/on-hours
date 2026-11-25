// The goal-met confetti. The pill window places the (hidden, click-through) "confetti" window around
// itself and tells it where the pill is; windows/confetti/ConfettiWindow.tsx draws the burst.
import { emitTo } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, PhysicalPosition, Window } from "@tauri-apps/api/window";

/** Where the pill sits inside the confetti window, in CSS px. `up`: room above, so it bursts upward. */
export type Burst = { x: number; y: number; w: number; h: number; up: boolean };
export const BURST = "confetti-burst";

/** Confetti window size in CSS px, as in tauri.conf.json. The pill sits low in it and the burst goes
 * up; at the top of the screen it sits high in it and the confetti fans out sideways and falls. */
const W = 420; // and 300 tall
const PILL_Y = 210;
const PILL_Y_TOP = 24;

export async function burstConfetti() {
  const confetti = await Window.getByLabel("confetti");
  if (!confetti) return;
  const pill = getCurrentWindow();
  const [pos, size, scale, monitor] = await Promise.all([pill.outerPosition(), pill.outerSize(), pill.scaleFactor(), currentMonitor()]);
  const w = size.width / scale;
  const h = size.height / scale;
  const x = (W - w) / 2;
  const up = !monitor || pos.y - PILL_Y * scale >= monitor.workArea.position.y;
  const y = up ? PILL_Y : PILL_Y_TOP;
  await confetti.setPosition(new PhysicalPosition(Math.round(pos.x - x * scale), Math.round(pos.y - y * scale)));
  await confetti.show(); // not focusable (tauri.conf.json): never takes the keyboard
  await emitTo("confetti", BURST, { x, y, w, h, up } satisfies Burst);
}
