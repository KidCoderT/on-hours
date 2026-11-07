import { fmtDate, fmtHM } from "../../lib/format";
import { HOUR } from "../../lib/time";
import type { useWeekHistory } from "./useWeekHistory";

type Day = ReturnType<typeof useWeekHistory>["days"][number];
type Props = { days: Day[]; goalMs: number; active: number; onPick: (i: number) => void };

/** One bar per day: total time worked, with the goal line as the reference. */
function WeekBars({ days, goalMs, active, onPick }: Props) {
  // Y scale in whole hours, ticks every 2h, always tall enough to show the goal.
  const maxH = Math.max(6, Math.ceil(Math.max(goalMs, ...days.map((d) => d.ms)) / HOUR / 2) * 2);
  const ticks = Array.from({ length: maxH / 2 + 1 }, (_, i) => i * 2).filter((t) => t * HOUR !== goalMs);
  const pct = (ms: number) => `${(ms / (maxH * HOUR)) * 100}%`;

  return (
    <>
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
              onMouseEnter={() => onPick(i)}
              onFocus={() => onPick(i)}
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
            {fmtDate(d.date, { weekday: "short" })}
          </span>
        ))}
      </div>
    </>
  );
}

export default WeekBars;
