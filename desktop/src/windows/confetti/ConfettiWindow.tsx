import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BURST, drawBurst, type Burst } from "../../lib/confetti";

/**
 * The goal-met confetti: a transparent, click-through window around the pill. On a burst, bits of
 * confetti (and a few stars) fly up and out from the pill, fall, fade, and the window hides again.
 * Design preview in a plain browser: ?window=confetti (click to burst again).
 */
function ConfettiWindow() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancel = () => {};
    const hide = () => {
      if (isTauri()) void getCurrentWindow().hide().catch((e) => console.error("could not hide the confetti", e));
    };
    const burst = (b: Burst) => {
      cancel();
      cancel = drawBurst(canvas.current!, b, hide);
    };

    if (!isTauri()) {
      const up = new URLSearchParams(location.search).get("top") !== "1";
      const demo = () => burst({ x: innerWidth / 2 - 120, y: up ? 210 : 24, w: 240, h: 48, up });
      demo();
      addEventListener("click", demo);
      return () => removeEventListener("click", demo);
    }
    const win = getCurrentWindow();
    // Clicks go through to whatever is underneath, the pill included.
    void win.setIgnoreCursorEvents(true).catch((e) => console.error("confetti window takes clicks", e));
    const off = win.listen<Burst>(BURST, (e) => burst(e.payload));
    return () => {
      cancel();
      void off.then((f) => f());
    };
  }, []);

  return <canvas ref={canvas} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }} />;
}

export default ConfettiWindow;
