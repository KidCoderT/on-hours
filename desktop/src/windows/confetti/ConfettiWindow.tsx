import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BURST, type Burst } from "../../lib/confetti";

const COLORS = ["#28c840", "#ffbd2e", "#ff5f57", "#4ea4ff", "#b58cff", "#ffffff"];
const COUNT = 46;
const LIFE_MS = 1600;
const GRAVITY = 900; // px/s²

type Bit = { x: number; y: number; vx: number; vy: number; spin: number; turn: number; size: number; color: string; star: boolean };

/**
 * The goal-met confetti: a transparent, click-through window around the pill. On a burst, bits of
 * confetti (and a few stars) fly up and out from the pill, fall, fade, and the window hides again.
 * Design preview in a plain browser: ?window=confetti (click to burst again).
 */
function ConfettiWindow() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const burst = (b: Burst) => {
      cancelAnimationFrame(frame);
      const c = canvas.current!;
      const dpr = devicePixelRatio;
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      const bits: Bit[] = Array.from({ length: COUNT }, () => {
        // Up: mostly upward, fanned to both sides. At the top of the screen: out to the sides, a little
        // up, from the pill's ends, then falling past it.
        const side = Math.random() < 0.5 ? -1 : 1;
        const angle = b.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.PI / 2 - side * (Math.PI / 2 + Math.random() * 0.7);
        const speed = b.up ? 260 + Math.random() * 320 : 160 + Math.random() * 260;
        return {
          x: b.up ? b.x + Math.random() * b.w : b.x + (side < 0 ? 0.15 : 0.85) * b.w, y: b.y + b.h * 0.4,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          spin: Math.random() * Math.PI, turn: (Math.random() - 0.5) * 14,
          size: 4 + Math.random() * 4, color: COLORS[(Math.random() * COLORS.length) | 0], star: Math.random() < 0.2,
        };
      });
      const t0 = performance.now();
      let last = t0;
      const tick = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        const age = (now - t0) / LIFE_MS;
        g.clearRect(0, 0, innerWidth, innerHeight);
        if (age >= 1) {
          if (isTauri()) void getCurrentWindow().hide().catch((e) => console.error("could not hide the confetti", e));
          return;
        }
        g.globalAlpha = Math.min(1, (1 - age) * 2.5); // full, then fades over the last 40%
        for (const p of bits) {
          p.vy += GRAVITY * dt;
          p.vx *= 1 - 1.2 * dt; // air drag
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.spin += p.turn * dt;
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.spin);
          g.fillStyle = p.color;
          if (p.star) star(g, p.size * 0.8);
          else g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.abs(Math.sin(p.spin)) * p.size * 0.5);
          g.restore();
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
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
      cancelAnimationFrame(frame);
      void off.then((f) => f());
    };
  }, []);

  return <canvas ref={canvas} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }} />;
}

function star(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  g.fill();
}

export default ConfettiWindow;
