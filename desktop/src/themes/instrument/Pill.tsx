import { fmtClock, fmtHMM } from "../../lib/format";
import { PauseIcon, PlayIcon, SlidersIcon } from "../../components/icons";
import type { PillModel } from "../types";
import Seg from "./Seg";
import "./pill.css";

const GAUGE_SEGMENTS = 10;

// RUN: working, under goal. MET: goal reached. HOLD: paused, recently (blinking from the nudge on).
// IDLE: paused too long. ALM: the alarm. BRK: a planned break: the digits count it down, the
// second line keeps today's total.
type Mode = "run" | "met" | "hold" | "idle" | "alm" | "brk";

/** A hardware readout: seven-segment digits, a progress gauge, and an LCD annunciator. */
function Pill({ m }: { m: PillModel }) {
  const mode: Mode = m.pause === "break" ? "brk" : m.done ? "met" : m.running ? "run" : m.pause === "alarm" ? "alm" : m.pause === "long" ? "idle" : "hold";
  // Annunciator second line: the number that matters next.
  const sub = mode === "met" ? "+" + fmtHMM(m.elapsedMs - m.goalMs) : mode === "run" ? "−" + fmtHMM(m.goalMs - m.elapsedMs) : mode === "brk" ? fmtHMM(m.elapsedMs) : fmtHMM(m.pausedMs);
  const lit = Math.floor(m.progress * GAUGE_SEGMENTS);

  return (
    <div className="pill" data-theme="instrument" data-mode={mode} data-pause={m.pause}>
      <span className="readout" aria-hidden="true">
        <Seg value={fmtClock(mode === "brk" ? m.breakLeftMs : m.elapsedMs)} glass="88:88:88" className="pill-digits" />
        <span className="gauge">
          {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => <i key={i} data-on={i < lit} style={{ "--i": i } as React.CSSProperties} />)}
        </span>
      </span>
      <span className="annunciator" aria-hidden="true">
        <span className="word">{mode}</span>
        <span className="sub">{sub}</span>
      </span>
      <span className="keys">
        <button type="button" onClick={m.toggle} disabled={!m.ready} aria-label={m.running ? "Pause" : "Start"}>
          {m.running ? <PauseIcon /> : <PlayIcon />}
        </button>
        {m.showSettingsButton && (
          <button type="button" className="settings-key" onClick={m.openSettings} aria-label="Settings">
            <SlidersIcon />
          </button>
        )}
      </span>
    </div>
  );
}

export default Pill;
