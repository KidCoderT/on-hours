import { useRef, useState } from "react";
import { useInView } from "motion/react";
import WeekBars from "@app/components/history/WeekBars";
import WeekTimeline from "@app/components/history/WeekTimeline";
import "@app/components/history/history.css";
import { fmtDate, fmtHM } from "@app/lib/format";
import { Reveal } from "../ui/Reveal";
import { Segmented } from "../ui/Segmented";

const HOUR = 3_600_000;
const MIN = 60_000;
const GOAL = 4 * HOUR;
const TODAY = 4; // Friday: the sample week is in progress

// A sample week, Monday first: [day, start hour, start minute, length in minutes].
const MONDAY = new Date(2026, 10, 2);
const BLOCKS: [number, number, number, number][] = [
  [0, 9, 0, 150], [0, 14, 0, 100],
  [1, 10, 30, 120], [1, 15, 0, 90],
  [2, 8, 0, 180], [2, 13, 30, 90], [2, 19, 0, 50],
  [3, 9, 0, 240], [3, 15, 30, 45],
  [4, 9, 0, 95], [4, 11, 30, 100],
];
const DAYS = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(2026, 10, 2 + i);
  const from = date.getTime();
  const spans = BLOCKS.filter(([d]) => d === i).map(([, h, m, len]) => ({ start: from + h * HOUR + m * MIN, end: from + h * HOUR + (m + len) * MIN }));
  return { date, from, spans, ms: spans.reduce((s, x) => s + x.end - x.start, 0), future: i > TODAY, today: i === TODAY };
});
const TOTAL = DAYS.reduce((s, d) => s + d.ms, 0);
const CLOSED = DAYS.slice(0, TODAY);
const KEPT = CLOSED.filter((d) => d.ms >= GOAL).length;

type View = "totals" | "timeline";

/** The app's own chart components, fed a sample week. The frame around them mirrors HistoryChart. */
export function Week() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
  const [view, setView] = useState<View>("totals");
  const [picked, setPicked] = useState<number | null>(null);
  const active = picked ?? TODAY;
  const day = DAYS[active];
  const diff = active > 0 ? day.ms - DAYS[active - 1].ms : 0;
  // Bars start flat and grow when the chart scrolls into view (the app's own height transition).
  const days = seen ? DAYS : DAYS.map((d) => ({ ...d, ms: 0, spans: [] }));

  return (
    <section className="section wrap" id="week">
      <div className="week-layout">
        <Reveal className="week-copy">
          <p className="eyebrow">History</p>
          <h2 className="section-title">See how the week really went.</h2>
          <p className="section-lead">
            Every session is saved on your own computer. Open settings and the week is there: which days you kept
            your word, which you didn't, and when the work actually happened.
          </p>
          <ul className="ticks">
            <li>Daily totals against your goal</li>
            <li>A timeline of every session</li>
            <li>This week compared with last week</li>
          </ul>
        </Reveal>
        <Reveal className="week-panel" delay={0.12}>
          <div ref={ref} className="history app-panel">
            <div className="section-heading">
              <h3>History</h3>
              <span className="week-range">{fmtDate(MONDAY, { month: "short", day: "numeric" })} – {fmtDate(DAYS[6].date, { month: "short", day: "numeric" })}</span>
            </div>
            <div className="week-stat">
              <div className="week-summary">
                <span className="stat-label">Total focused time</span>
                <span className="week-total">{fmtHM(TOTAL)}</span>
                <span className="delta up">▲ 13%<span className="vs"> vs last week</span></span>
              </div>
              <Segmented name="week-view" label="Chart view" value={view} options={[{ id: "totals", label: "Totals" }, { id: "timeline", label: "Timeline" }]} onPick={setView} />
            </div>
            <div className="chart" data-view={view} onMouseLeave={() => setPicked(null)}>
              {view === "timeline" ? <WeekTimeline days={days} goalMs={GOAL} active={active} onPick={setPicked} /> : <WeekBars days={days} goalMs={GOAL} active={active} onPick={setPicked} />}
            </div>
            <div className="day-detail" aria-live="polite">
              <span className="day">
                <span className="dot" aria-hidden="true" style={{ background: day.ms >= GOAL ? "var(--green)" : "var(--red)" }} />
                {day.today ? "Today" : fmtDate(day.date, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span className="num">{fmtHM(day.ms)}</span>
              {active > 0 && (
                <span className={`delta ${diff >= 0 ? "up" : "down"}`}>
                  {diff >= 0 ? "▲" : "▼"} {fmtHM(Math.abs(diff))}
                  <span className="vs"> vs {fmtDate(DAYS[active - 1].date, { weekday: "short" })}</span>
                </span>
              )}
            </div>
            <p className="memo">{KEPT} of {CLOSED.length} days kept · goal {fmtHM(GOAL)} a day</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
