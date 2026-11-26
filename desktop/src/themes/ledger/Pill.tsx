import "@fontsource-variable/source-serif-4/opsz.css";
import { fmtClock, fmtHMM } from "../../lib/format";
import { BookIcon, PauseIcon, PlayIcon } from "../../components/icons";
import type { PillModel } from "../types";
import "./pill.css";

/**
 * Today's line in the book. Ink while running, pencil while briefly paused, blue-black ink on a
 * planned break (the figure counts it down), and green ink with a double underline once the goal is kept. A pause that drags on gets marked up, harder each stage:
 * nudge underlines the note in red, a long pause turns the line red and stamps the note OVERDUE,
 * and the alarm re-stamps the note with what is still owed today (the figure is never struck: it's earned).
 * On a stretch past the goal the figure goes back to ink (still at it), its double rule only while paused,
 * the diamond stays green (kept), and the margin note says how much of the stretch is left.
 */
function Pill({ m }: { m: PillModel }) {
  const late = m.pause === "long" || m.pause === "alarm";
  const onBreak = m.pause === "break";
  const entry = onBreak ? "rest" : m.done ? "kept" : m.running ? "ink" : late ? "idle" : "pencil";
  const stretching = m.done && m.elapsedMs < m.targetMs; // kept, and pushing on for today's stretch
  const note =
    onBreak ? "break"
    : stretching ? `−${fmtHMM(m.targetMs - m.elapsedMs)}`
    : m.pause === "alarm" ? `owe ${fmtHMM(m.goalMs - m.elapsedMs)}`
    : late ? "overdue"
    : `held ${fmtHMM(m.pausedMs)}`;

  return (
    <div className="pill" data-theme="ledger" data-entry={entry} data-stretch={stretching} data-running={m.running} data-pause={m.pause}>
      <span className="mark" aria-hidden="true" />
      <span className="margin-rule" aria-hidden="true" />
      <span className="figure" aria-hidden="true">{fmtClock(onBreak ? m.breakLeftMs : m.elapsedMs)}</span>
      {(entry === "pencil" || entry === "idle" || entry === "rest" || stretching) && <span className="note" aria-hidden="true">{note}</span>}
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
