import { fmtDate, fmtHM } from "../../lib/format";
import { HOUR } from "../../lib/time";
import { Legend } from "./WeekTimeline";
import type { useWeekHistory } from "./useWeekHistory";

type Day = ReturnType<typeof useWeekHistory>["days"][number];
type Props = { days: Day[]; goalMs: number; active: number; onPick: (i: number) => void };

/**
 * One column per day, three bars overlaid: the PC-on time behind (a wide violet bar), the time
 * worked in front (green once the goal is met), and the breaks stacked on top of it in yellow.
 * The goal line is the reference. A day stretched past the goal has a mark at goal + stretch:
 * solid once made, dashed if not (the day still counts as kept at the goal).
 */
function WeekBars({ days, goalMs, active, onPick }: Props) {
  // Y scale in whole hours, ticks every 2h, always tall enough to show the goal and the PC-on time.
  const maxH = Math.max(6, Math.ceil(Math.max(goalMs, ...days.map((d) => Math.max(d.ms + d.breakMs, d.onMs, goalMs + d.extraMs))) / HOUR / 2) * 2);
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
              aria-label={`${fmtDate(d.date, { weekday: "long", month: "short", day: "numeric" })}: ${fmtHM(d.ms)}, ${d.ms >= goalMs ? "goal met" : "under goal"}${d.onMs ? `, PC on ${fmtHM(d.onMs)}` : ""}${d.breakMs ? `, breaks ${fmtHM(d.breakMs)}` : ""}${d.extraMs ? `, stretched ${fmtHM(d.extraMs)} past the goal` : ""}`}
            >
              {!d.future && (
                <>
                  <span className="bar-on" style={{ height: pct(d.onMs) }} />
                  <span className="bar" style={{ height: `max(2px, ${pct(d.ms)})` }} />
                  <span className="bar-break" style={{ bottom: pct(d.ms), height: pct(d.breakMs) }} />
                  {d.extraMs > 0 && <span className="stretch-mark" data-made={d.ms >= goalMs + d.extraMs} style={{ bottom: pct(goalMs + d.extraMs) }} />}
                </>
              )}
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
      <Legend />
    </>
  );
}

export default WeekBars;
