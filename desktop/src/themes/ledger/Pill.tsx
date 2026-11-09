import "@fontsource-variable/source-serif-4/opsz.css";
import { fmtClock, fmtHMM } from "../../lib/format";
import { BookIcon, PauseIcon, PlayIcon } from "../../components/icons";
import type { PillModel } from "../types";
import "./pill.css";

/**
 * Today's line in the book. Ink while running, pencil while briefly paused,
 * red ink once the pause is long, green ink and a double underline once the goal is kept.
 */
function Pill({ m }: { m: PillModel }) {
  const entry = m.done ? "kept" : m.running ? "ink" : m.pause === "long" ? "idle" : "pencil";

  return (
    <div className="pill" data-theme="ledger" data-entry={entry} data-running={m.running}>
      <span className="mark" aria-hidden="true" />
      <span className="margin-rule" aria-hidden="true" />
      <span className="figure" aria-hidden="true">{fmtClock(m.elapsedMs)}</span>
      {(entry === "pencil" || entry === "idle") && <span className="note" aria-hidden="true">{entry === "idle" ? "idle" : "held"} {fmtHMM(m.pausedMs)}</span>}
      <button type="button" className="toggle" onClick={m.toggle} disabled={!m.ready} aria-label={m.running ? "Pause" : "Start"}>
        {m.running ? <PauseIcon /> : <PlayIcon />}
      </button>
      {m.showSettingsButton && (
        <button type="button" className="book" onClick={m.openSettings} aria-label="Settings">
          <BookIcon />
        </button>
      )}
    </div>
  );
}

export default Pill;
