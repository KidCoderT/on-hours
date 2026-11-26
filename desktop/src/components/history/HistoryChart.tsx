import { useRef, useState } from "react";
import { fmtDate, fmtHM } from "../../lib/format";
import { addDays } from "../../lib/time";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { useWeekHistory } from "./useWeekHistory";
import WeekBars from "./WeekBars";
import WeekTimeline from "./WeekTimeline";
import "./history.css";

type Props = { goalMs: number; dayStart: string; weekStart: number; restDays: number[] };
type View = "totals" | "timeline";
const VIEWS: View[] = ["totals", "timeline"];

function HistoryChart({ goalMs, dayStart, weekStart, restDays }: Props) {
  const [offset, setOffset] = useState(0); // weeks back from this week
  const [picked, setPicked] = useState<number | null>(null);
  const wheelLock = useRef(0);
  const [view, setView] = useState<View>(() => (localStorage.getItem("history-view") as View) ?? "totals");
  const pickView = (v: View) => {
    localStorage.setItem("history-view", v);
    setView(v);
  };
  const { first, days, elapsed, total, weekPct, maxOffset, worked } = useWeekHistory(offset, dayStart, weekStart, restDays);

  const active = picked ?? elapsed - 1;
  const day = days[Math.max(0, active)];
  const diff = day.ms - worked(addDays(day.date, -1));
  const prevName = fmtDate(addDays(day.date, -1), { weekday: "short" });

  const page = (step: number) => {
    setOffset((o) => Math.min(maxOffset, Math.max(0, o + step)));
    setPicked(null);
  };

  // Horizontal swipes page weeks; vertical scrolling belongs to the settings page.
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const delta = e.deltaX;
    if (Math.abs(delta) < 4 || Date.now() - wheelLock.current < 450) return;
    wheelLock.current = Date.now();
    page(delta > 0 ? -1 : 1); // down/right = newer
  };

  const range = `${fmtDate(first, { month: "short", day: "numeric" })} – ${fmtDate(addDays(first, 6), { month: "short", day: "numeric" })}`;
  // The week's verdict, from the Ledger: only days that are over count. Today is still open.
  // A rest day counts only if it was kept anyway: missing one is the plan, not a miss.
  const off = (d: (typeof days)[number]) => d.rest && d.ms < goalMs;
  const closed = days.filter((d) => !d.future && !d.today && !off(d));
  const kept = closed.filter((d) => d.ms >= goalMs).length;

  return (
    <section className="history" aria-labelledby="history-heading">
      <div className="section-heading">
        <h2 id="history-heading">History</h2>
        <div className="week-nav">
          <button type="button" onClick={() => page(1)} disabled={offset >= maxOffset} aria-label="Previous week">
            <ChevronLeftIcon />
          </button>
          <span>{offset === 0 ? "This week" : range}</span>
          <button type="button" onClick={() => page(-1)} disabled={offset === 0} aria-label="Next week">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="week-stat">
        <div className="week-summary">
          <span className="stat-label">Total focused time</span>
          <span className="week-total">{fmtHM(total)}</span>
          {weekPct !== null && (
            <span className={`delta ${weekPct >= 0 ? "up" : "down"}`}>
              {weekPct >= 0 ? "▲" : "▼"} {Math.abs(weekPct)}%
              <span className="vs"> vs last week</span>
            </span>
          )}
        </div>
        <div className="segmented view-switch" role="radiogroup" aria-label="Chart view">
          {VIEWS.map((v) => (
            <label key={v}>
              <input type="radio" name="history-view" className="sr-only" checked={view === v} onChange={() => pickView(v)} />
              <span>{v === "totals" ? "Totals" : "Timeline"}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="chart" data-view={view} onWheel={onWheel} onMouseLeave={() => setPicked(null)}>
        {view === "timeline" ? (
          <WeekTimeline days={days} goalMs={goalMs} active={active} onPick={setPicked} />
        ) : (
          <WeekBars days={days} goalMs={goalMs} active={active} onPick={setPicked} />
        )}
      </div>

      <div className="day-detail" aria-live="polite">
        <span className="day">
          <span className="dot" aria-hidden="true" style={{ "--dot": day.ms >= goalMs ? "var(--green)" : off(day) ? "var(--muted)" : "var(--red)" } as React.CSSProperties} />
          {day.today ? "Today" : fmtDate(day.date, { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <span className="num">{fmtHM(day.ms)}</span>
        {off(day) && <span className="vs">rest day</span>}
        <span className={`delta ${diff >= 0 ? "up" : "down"}`}>
          {diff === 0 ? "=" : diff > 0 ? "▲" : "▼"} {fmtHM(Math.abs(diff))}
          <span className="vs"> vs {prevName}</span>
        </span>
      </div>
      {/* Work always happens with the PC on, so less PC time than work means the log doesn't cover the
          day (the day it was installed): the comparison would be wrong, so leave it out. */}
      {day.onMs > 0 && day.onMs >= day.ms && (
        <p className="usage">
          PC on {fmtHM(day.onMs)} · focused {fmtHM(day.ms)} ({Math.round((day.ms / day.onMs) * 100)}%)
          {day.breakMs > 0 && <> · breaks {fmtHM(day.breakMs)}</>}
        </p>
      )}
      {day.extraMs > 0 && (
        <p className="usage">
          Stretched {fmtHM(day.extraMs)} past the goal · {day.ms >= goalMs + day.extraMs ? "made it" : `${fmtHM(goalMs + day.extraMs - day.ms)} short`}
        </p>
      )}
      {closed.length > 0 && (
        <p className="memo">
          {kept} of {closed.length} {closed.length === 1 ? "day" : "days"} kept · goal {fmtHM(goalMs)} a day
        </p>
      )}
    </section>
  );
}

export default HistoryChart;
