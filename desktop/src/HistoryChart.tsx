import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { dayRange, firstSessionStart, sessionsBetween, trimmedTotal, workDayOf, type Session } from "./db";

const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

const fmtHM = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

type Props = { goalMs: number; dayStart: string };

function HistoryChart({ goalMs, dayStart }: Props) {
  const today = startOfDay(workDayOf(new Date(), dayStart));
  const thisMonday = mondayOf(today);
  const [offset, setOffset] = useState(0); // weeks back from this week
  const [picked, setPicked] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [maxOffset, setMaxOffset] = useState(0); // can't page back past the first session
  const wheelLock = useRef(0);

  const monday = addDays(thisMonday, -7 * offset);
  // Load this week plus the week before it (for the "vs last week / vs yesterday" deltas).
  const from = dayRange(addDays(monday, -7), dayStart).from;
  const to = dayRange(addDays(monday, 6), dayStart).to;

  useEffect(() => {
    if (!isTauri()) return; // design preview: empty chart
    const load = () => {
      sessionsBetween(from, to).then(setSessions);
      firstSessionStart().then((t) => setMaxOffset(t ? Math.round((+thisMonday - +mondayOf(new Date(t))) / WEEK) : 0));
    };
    load();
    // The window is hidden, not closed, so refresh each time it's brought back.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [from, to, +thisMonday]);

  // ponytail: a running session counts up to "now" but only refreshes on focus / paging; add a timer if a live chart matters.
  const worked = (date: Date) => {
    const r = dayRange(date, dayStart);
    const now = Date.now();
    return trimmedTotal(sessions.map((s) => (s.open ? { ...s, end_ms: now } : s)), r.from, r.to);
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, ms: worked(date), future: date > today, today: +date === +today };
  });

  // Week total vs the same number of days last week (fair for a week in progress).
  const elapsed = days.filter((d) => !d.future).length;
  const total = days.reduce((s, d) => s + d.ms, 0);
  const prevTotal = days.slice(0, elapsed).reduce((s, d) => s + worked(addDays(d.date, -7)), 0);
  const weekPct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  // Y scale in whole hours, ticks every 2h, always tall enough to show the goal.
  const maxH = Math.max(6, Math.ceil(Math.max(goalMs, ...days.map((d) => d.ms)) / HOUR / 2) * 2);
  const ticks = Array.from({ length: maxH / 2 + 1 }, (_, i) => i * 2).filter((t) => t * HOUR !== goalMs);
  const pct = (ms: number) => `${(ms / (maxH * HOUR)) * 100}%`;

  const active = picked ?? elapsed - 1;
  const day = days[Math.max(0, active)];
  const diff = day.ms - worked(addDays(day.date, -1));
  const prevName = fmtDate(addDays(day.date, -1), { weekday: "short" });

  const page = (step: number) => {
    setOffset((o) => Math.min(maxOffset, Math.max(0, o + step)));
    setPicked(null);
  };

  // Scroll / trackpad swipe pages weeks; locked briefly so one flick = one week.
  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 4 || Date.now() - wheelLock.current < 450) return;
    wheelLock.current = Date.now();
    page(delta > 0 ? -1 : 1); // down/right = newer
  };

  const range = `${fmtDate(monday, { month: "short", day: "numeric" })} – ${fmtDate(addDays(monday, 6), { month: "short", day: "numeric" })}`;

  return (
    <section className="history" aria-labelledby="history-heading">
      <div className="section-heading">
        <h2 id="history-heading">History</h2>
        <div className="week-nav">
          <button type="button" onClick={() => page(1)} disabled={offset >= maxOffset} aria-label="Previous week">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
          </button>
          <span>{offset === 0 ? "This week" : range}</span>
          <button type="button" onClick={() => page(-1)} disabled={offset === 0} aria-label="Next week">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
          </button>
        </div>
      </div>

      <div className="week-stat">
        <span className="week-total">{fmtHM(total)}</span>
        {weekPct !== null && (
          <span className={`delta ${weekPct >= 0 ? "up" : "down"}`}>
            {weekPct >= 0 ? "▲" : "▼"} {Math.abs(weekPct)}%
            <span className="vs"> vs last week</span>
          </span>
        )}
      </div>

      <div className="chart" onWheel={onWheel} onMouseLeave={() => setPicked(null)}>
        <div className="plot">
          {ticks.map((t) => (
            <div key={t} className="grid" style={{ bottom: pct(t * HOUR) }}>
              <span>{t}h</span>
            </div>
          ))}
          <div className="grid goal" style={{ bottom: pct(goalMs) }}>
            <span>Goal</span>
          </div>
          <div className="cols">
            {days.map((d, i) => (
              <button
                type="button"
                key={i}
                className="col"
                data-active={i === active}
                data-met={d.ms >= goalMs}
                disabled={d.future}
                onMouseEnter={() => setPicked(i)}
                onFocus={() => setPicked(i)}
                aria-label={`${fmtDate(d.date, { weekday: "long", month: "short", day: "numeric" })}: ${fmtHM(d.ms)}, ${d.ms >= goalMs ? "goal met" : "under goal"}`}
              >
                {!d.future && <span className="bar" style={{ height: `max(2px, ${pct(d.ms)})` }} />}
              </button>
            ))}
          </div>
        </div>
        <div className="xlabels" aria-hidden="true">
          {days.map((d, i) => (
            <span key={i} data-today={d.today} data-future={d.future}>
              {fmtDate(d.date, { weekday: "narrow" })}
            </span>
          ))}
        </div>
      </div>

      <div className="day-detail" aria-live="polite">
        <span className="day">
          <span className="dot" aria-hidden="true" style={{ "--dot": day.ms >= goalMs ? "var(--green)" : "var(--red)" } as React.CSSProperties} />
          {day.today ? "Today" : fmtDate(day.date, { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <span className="num">{fmtHM(day.ms)}</span>
        <span className={`delta ${diff >= 0 ? "up" : "down"}`}>
          {diff === 0 ? "=" : diff > 0 ? "▲" : "▼"} {fmtHM(Math.abs(diff))}
          <span className="vs"> vs {prevName}</span>
        </span>
      </div>
    </section>
  );
}

export default HistoryChart;
