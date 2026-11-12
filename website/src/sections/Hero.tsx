import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DemoPill } from "../demo/DemoPill";
import { HOUR, useDemoTimer } from "../demo/useDemoTimer";
import { REPO, type Release } from "../lib/release";
import { DownloadButton } from "../ui/DownloadButton";

const HEADLINE = ["Count", "the", "hours", "you", "actually", "work."];
const GOAL = 4 * HOUR;
const ease = [0.2, 0.7, 0.2, 1] as const;

/**
 * The opening: the real pill, paused. A pointer presses play, the day runs by in two seconds,
 * the light turns green, and the pill is handed to the visitor.
 */
export function Hero({ release }: { release: Release }) {
  const still = useReducedMotion();
  const { model, set } = useDemoTimer(still ? { elapsedMs: GOAL + 12 * 60_000, running: true, pausedMs: 0 } : { elapsedMs: 0, running: false, pausedMs: 0 }, { goalMs: GOAL });
  const [pointer, setPointer] = useState<"away" | "moving" | "press" | "gone">(still ? "gone" : "away");
  const taken = useRef(false); // the visitor touched the pill: stop the script

  useEffect(() => {
    if (still) return;
    const timers: number[] = [];
    let frame = 0;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(() => !taken.current && fn(), ms));
    at(1500, () => setPointer("moving"));
    at(2500, () => setPointer("press"));
    at(2650, () => {
      setPointer("gone");
      const t0 = performance.now();
      const run = (now: number) => {
        if (taken.current) return;
        const p = Math.min(1, (now - t0) / 2400);
        const eased = 1 - Math.pow(1 - p, 3);
        set({ elapsedMs: eased * (GOAL + 3000), running: true, pausedMs: 0 });
        if (p < 1) frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    });
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
    };
  }, [still, set]);

  const take = () => {
    taken.current = true;
    setPointer("gone");
  };

  return (
    <section className="hero wrap" id="top">
      <h1 className="hero-title">
        {HEADLINE.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.08 * i, ease }}
          >
            {word}{" "}
          </motion.span>
        ))}
      </h1>
      <motion.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }}>
        A tiny timer that sits on top of your screen. On when you work, off when you stop.
        At the end of the day, the number doesn't lie.
      </motion.p>
      <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7, ease }}>
        <DownloadButton release={release} />
        <a className="btn btn-quiet" href={REPO} target="_blank" rel="noreferrer">View on GitHub</a>
      </motion.div>
      <motion.p className="hero-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.85 }}>
        Free and open source · Windows 10 and 11{release.version ? ` · ${release.version}` : ""}
      </motion.p>

      <motion.div className="hero-stage" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.9, ease }}>
        <div className="hero-pill-spot" onPointerDown={take} onKeyDown={take}>
          <DemoPill theme="baseline" model={model} className="hero-pill" />
          {pointer !== "gone" && (
            <motion.span
              className="hero-pointer"
              aria-hidden="true"
              initial={{ opacity: 0, x: 130, y: 110 }}
              animate={pointer === "away" ? { opacity: 0, x: 130, y: 110 } : pointer === "moving" ? { opacity: 1, x: 0, y: 0 } : { opacity: 1, x: 0, y: 0, scale: 0.8 }}
              transition={{ duration: pointer === "press" ? 0.12 : 0.9, ease }}
            >
              <svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 8-6.2 1.6L9.6 19z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            </motion.span>
          )}
        </div>
        <div className="hero-window" aria-hidden="true">
          <div className="hero-window-bar"><i /><i /><i /></div>
          <div className="hero-window-body">
            <div className="hero-side">{[62, 80, 48, 70, 56].map((w, i) => <b key={i} style={{ width: `${w}%` }} />)}</div>
            <div className="hero-lines">{[38, 92, 86, 95, 64, 0, 90, 82, 94, 47].map((w, i) => <b key={i} data-head={i === 0} style={{ width: `${w}%` }} />)}</div>
          </div>
        </div>
        <p className="hero-hint">That's the real pill. Press play.</p>
      </motion.div>
    </section>
  );
}
