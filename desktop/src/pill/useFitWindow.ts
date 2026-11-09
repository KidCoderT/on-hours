import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";

/**
 * Keep the pill window as wide as the current theme needs.
 *
 * - First fit after launch sizes in place. The window-state plugin restores position only, and the
 *   window always opens at tauri.conf.json's width, so anchoring here would drift the pill on
 *   every restart.
 * - Later changes (style or settings button) keep the right edge where it was, so a pill parked
 *   against the right side of the screen grows leftward instead of off-screen.
 * - Fits run one at a time and always use the latest width, so fast clicking can't apply a stale size.
 * - Size first, then position: if the move fails the window is merely unanchored, never clipped.
 */
export function useFitWindow(width: number, enabled: boolean) {
  const wanted = useRef(width);
  const fitted = useRef(false);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    if (!enabled || !isTauri()) return;
    wanted.current = width;
    queue.current = queue.current
      .then(async () => {
        const anchorRight = fitted.current;
        await fit(wanted.current, anchorRight);
        fitted.current = true;
      })
      .catch((e) => console.error("could not resize the pill", e));
  }, [width, enabled]);
}

async function fit(cssWidth: number, anchorRight: boolean) {
  const win = getCurrentWindow();
  const [pos, size, scale] = await Promise.all([win.outerPosition(), win.innerSize(), win.scaleFactor()]);
  const target = Math.round(cssWidth * scale);
  if (target === size.width) return;
  await win.setSize(new PhysicalSize(target, size.height));
  if (anchorRight) await win.setPosition(new PhysicalPosition(pos.x + size.width - target, pos.y));
  await saveWindowState(StateFlags.POSITION);
}
