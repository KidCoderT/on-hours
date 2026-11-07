import { useRef, useState } from "react";

const HOUR = 3_600_000;
const GOAL_MS = 4 * HOUR; // ponytail: same constant as the pill; moves to the settings DB
const WEEKS_BACK = 12; // how far back the mock history goes

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ponytail: fake but stable numbers per date until sessions are stored in SQLite.
function worked(date: Date): number {
  if (date > startOfDay(new Date())) return 0;
  const seed = Math.floor(date.getTime() / 86_400_000);
  const r = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  return Math.round((weekend ? r * 3 : 1.5 + r * 4.5) * HOUR);
}

const fmtHM = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

function HistoryChart() {
  const today = startOfDay(new Date());
  const thisMonday = addDays(today, -((today.getDay() + 6) % 7));
  const [offset, setOffset] = useState(0); // weeks back from this week
  const [picked, setPicked] = useState<number | null>(null);
  const wheelLock = useRef(0);

  const monday = addDays(thisMonday, -7 * offset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, ms: worked(date), future: date > today, today: +date === +today };
  });

  // Week total vs the same number of days last week (fair for a week in progress).
  const elapsed = days.filter((d) => !d.future).length;
  const total = days.reduce((s, d) => s + d.ms, 0);
  const prevTotal = days.slice(0, elapsed).reduce((s, d) => s + worked(addDays(d.date, -7)), 0);
  const weekPct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  // Y scale in whole hours, ticks every 2h, always showing the goal.
  const maxH = Math.max(6, Math.ceil(Math.max(...days.map((d) => d.ms)) / HOUR / 2) * 2);
  const ticks = Array.from({ length: maxH / 2 + 1 }, (_, i) => i * 2);
  const pct = (ms: number) => `${(ms / (maxH * HOUR)) * 100}%`;

  const active = picked ?? elapsed - 1;
  const day = days[Math.max(0, active)];
  const prevDayMs = worked(addDays(day.date, -1));
  const diff = day.ms - prevDayMs;
  const prevName = fmtDate(addDays(day.date, -1), { weekday: "short" });

  const page = (step: number) => {
    setOffset((o) => Math.min(WEEKS_BACK, Math.max(0, o + step)));
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
          <button type="button" onClick={() => page(1)} disabled={offset === WEEKS_BACK} aria-label="Previous week">
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
            <div key={t} className={`grid${t * HOUR === GOAL_MS ? " goal" : ""}`} style={{ bottom: pct(t * HOUR) }}>
              <span>{t * HOUR === GOAL_MS ? "Goal" : `${t}h`}</span>
            </div>
          ))}
          <div className="cols">
            {days.map((d, i) => (
              <button
                type="button"
                key={i}
                className="col"
                data-active={i === active}
                data-met={d.ms >= GOAL_MS}
                disabled={d.future}
                onMouseEnter={() => setPicked(i)}
                onFocus={() => setPicked(i)}
                aria-label={`${fmtDate(d.date, { weekday: "long", month: "short", day: "numeric" })}: ${fmtHM(d.ms)}, ${d.ms >= GOAL_MS ? "goal met" : "under goal"}`}
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
          <span className="dot" aria-hidden="true" style={{ "--dot": day.ms >= GOAL_MS ? "var(--green)" : "var(--red)" } as React.CSSProperties} />
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
