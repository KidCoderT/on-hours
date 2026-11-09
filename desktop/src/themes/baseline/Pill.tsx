import { fmtClock } from "../../lib/format";
import { PauseIcon, PlayIcon, SlidersIcon } from "../../components/icons";
import type { PillModel } from "../types";
import "./pill.css";

/** The original pill: a status dot (red paused, yellow working, green goal met) and today's total. */
function Pill({ m }: { m: PillModel }) {
  return (
    <div className="pill" data-theme="baseline" data-running={m.running} data-done={m.done}>
      <span className="dot" aria-hidden="true" />
      <span className="time" aria-hidden="true">{fmtClock(m.elapsedMs)}</span>
      <span className="rule" aria-hidden="true" />
      <button type="button" onClick={m.toggle} disabled={!m.ready} aria-label={m.running ? "Pause" : "Start"}>
        {m.running ? <PauseIcon /> : <PlayIcon />}
      </button>
      {m.showSettingsButton && (
        <button type="button" className="settings-btn" onClick={m.openSettings} aria-label="Settings">
          <SlidersIcon />
        </button>
      )}
    </div>
  );
}

export default Pill;
