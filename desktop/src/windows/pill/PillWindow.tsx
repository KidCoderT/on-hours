import { Window } from "@tauri-apps/api/window";
import { useSettings } from "../../hooks/useSettings";
import { useWindowPosition } from "../../hooks/useWindowPosition";
import { fmtClock } from "../../lib/format";
import { PauseIcon, PlayIcon, SlidersIcon } from "../../components/icons";
import { useTimer } from "./useTimer";
import "./pill.css";

async function openSettings() {
  const win = await Window.getByLabel("settings");
  await win?.unminimize();
  await win?.show();
  await win?.setFocus();
}

function PillWindow() {
  const { settings, loaded } = useSettings();
  const { elapsed, running, done, ready, toggle } = useTimer(settings, loaded);
  useWindowPosition();

  const status = done ? "Daily goal met" : running ? "Working, daily goal not met" : "Paused, daily goal not met";

  return (
    <div className="pill" data-running={running} data-done={done} data-tauri-drag-region="deep">
      <span className="dot" role="img" aria-label={status} />
      <span className="time" aria-label={"Today: " + fmtClock(elapsed)}>{fmtClock(elapsed)}</span>
      <span className="rule" aria-hidden="true" />
      <button type="button" onClick={toggle} disabled={!ready} aria-label={running ? "Pause" : "Start"}>
        {running ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button type="button" className="settings-btn" onClick={openSettings} aria-label="Settings">
        <SlidersIcon />
      </button>
    </div>
  );
}

export default PillWindow;
