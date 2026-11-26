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

const COLORS = ["#28c840", "#ffbd2e", "#ff5f57", "#4ea4ff", "#b58cff", "#ffffff"];
const COUNT = 46;
const LIFE_MS = 1600;
const GRAVITY = 900; // px/s²

type Bit = { x: number; y: number; vx: number; vy: number; spin: number; turn: number; size: number; color: string; star: boolean };

/**
 * Draw one burst on `c` (sized to its CSS box), from the pill at `b`. Calls `done` when the last bit
 * fades. Returns a cancel. Pure canvas: the website plays it around its demo pill too.
 */
export function drawBurst(c: HTMLCanvasElement, b: Burst, done: () => void = () => {}) {
  const dpr = devicePixelRatio;
  const width = c.clientWidth;
  const height = c.clientHeight;
  c.width = width * dpr;
  c.height = height * dpr;
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
  let frame = 0;
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const age = (now - t0) / LIFE_MS;
    g.clearRect(0, 0, width, height);
    if (age >= 1) return done();
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
  return () => cancelAnimationFrame(frame);
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
