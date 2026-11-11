import "@fontsource-variable/inter"; // stands in for SF Pro where the system has none (Windows)
import { fmtClock } from "../../lib/format";
import { PauseIcon, PlayIcon, SlidersIcon } from "../../components/icons";
import type { PillModel } from "../types";
import "./pill.css";

/**
 * A Mac panel. The status light is a window traffic light: red paused, yellow working,
 * green goal met. Once the pause is long the red light bounces, then breathes.
 * Rules: design/DIRECTION_BASELINE.md.
 */
function Pill({ m }: { m: PillModel }) {
  return (
    <div className="pill" data-theme="baseline" data-running={m.running} data-done={m.done} data-pause={m.pause}>
      <span className="light" aria-hidden="true" />
      <span className="time" aria-hidden="true">{fmtClock(m.elapsedMs)}</span>
      <button type="button" className="toggle" onClick={m.toggle} disabled={!m.ready} aria-label={m.running ? "Pause" : "Start"}>
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
