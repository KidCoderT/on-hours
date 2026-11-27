import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { addSession, deleteSession, editSession, type Session } from "../../lib/db";
import { fmtHM, fmtTime } from "../../lib/format";
import { atWorkDay, dayRange, overlapsAny } from "../../lib/time";

type Props = { day: { date: Date; from: number }; dayStart: string; sessions: Session[]; onChanged: () => void };

/** Why [start, end) can't be saved, or "". */
const problem = (sessions: Session[], start: number, end: number, id?: number) =>
  end <= start ? "The end has to come after the start."
    : end > Date.now() ? "That ends in the future."
    : overlapsAny(sessions, start, end, id) ? "That overlaps another session."
    : "";

/**
 * Fix the record: the picked day's sessions, each with its start and end, to change or delete, and
 * a row to add one that was never timed. A session belongs to the day it started. The running one
 * is the timer's, so it's shown but can't be changed. Saving tells the pill to re-read today.
 */
function SessionEditor({ day, dayStart, sessions, onChanged }: Props) {
  const { from, to } = dayRange(day.date, dayStart);
  const mine = sessions.filter((s) => s.start_ms >= from && s.start_ms < to);
  const [error, setError] = useState("");
  const at = (hhmm: string) => atWorkDay(day.date, hhmm, dayStart);

  const run = async (change: () => Promise<unknown>) => {
    try {
      await change();
      setError("");
      if (isTauri()) await emit("sessions-changed");
      onChanged();
    } catch (e) {
      console.error("could not change a session", e);
      setError("Couldn't save that change. Try again.");
    }
  };
  const save = (start: number, end: number, id?: number) => {
    const why = problem(sessions, start, end, id);
    if (why) return setError(why), false;
    void run(() => (id === undefined ? addSession(start, end) : editSession(id, start, end)));
    return true;
  };

  return (
    <details className="sessions-edit">
      <summary>Edit sessions ({mine.length})</summary>
      <ul>
        {mine.map((s) => <Row key={`${s.id}-${s.start_ms}-${s.end_ms}`} s={s} at={at} save={save} remove={() => void run(() => deleteSession(s.id))} />)}
        <AddRow at={at} save={save} />
      </ul>
      {error && <p className="row-error" role="alert">{error}</p>}
    </details>
  );
}

type At = (hhmm: string) => number;

function Row({ s, at, save, remove }: { s: Session; at: At; save: (a: number, b: number, id?: number) => boolean; remove: () => void }) {
  const [start, setStart] = useState(fmtTime(s.start_ms));
  const [end, setEnd] = useState(fmtTime(s.end_ms));
  const [sure, setSure] = useState(false);
  if (s.open) {
    return <li><span className="times">{fmtTime(s.start_ms)} – now</span><span className="len">running</span></li>;
  }
  // A time left as it was keeps its seconds.
  const startMs = start === fmtTime(s.start_ms) ? s.start_ms : at(start);
  const endMs = end === fmtTime(s.end_ms) ? s.end_ms : at(end);
  const changed = startMs !== s.start_ms || endMs !== s.end_ms;
  return (
    <li>
      <span className="times">
        <input type="time" aria-label="Start" value={start} onChange={(e) => setStart(e.target.value)} />
        –
        <input type="time" aria-label="End" value={end} onChange={(e) => setEnd(e.target.value)} />
      </span>
      <span className="len">{fmtHM(Math.max(0, endMs - startMs))}</span>
      {changed && start && end && <button type="button" className="link" onClick={() => save(startMs, endMs, s.id)}>Save</button>}
      <button type="button" className="link danger" onClick={() => (sure ? remove() : setSure(true))} onBlur={() => setSure(false)}>
        {sure ? "Delete it?" : "Delete"}
      </button>
    </li>
  );
}

function AddRow({ at, save }: { at: At; save: (a: number, b: number) => boolean }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const add = () => {
    if (save(at(start), at(end))) {
      setStart("");
      setEnd("");
    }
  };
  return (
    <li className="add">
      <span className="times">
        <input type="time" aria-label="New session start" value={start} onChange={(e) => setStart(e.target.value)} />
        –
        <input type="time" aria-label="New session end" value={end} onChange={(e) => setEnd(e.target.value)} />
      </span>
      <button type="button" className="link" disabled={!start || !end} onClick={add}>Add session</button>
    </li>
  );
}

export default SessionEditor;
