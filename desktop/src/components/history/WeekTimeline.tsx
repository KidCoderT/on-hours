import { useState } from "react";
import { fmtDate, fmtHM, fmtTime } from "../../lib/format";
import { HOUR } from "../../lib/time";
import type { useWeekHistory } from "./useWeekHistory";

type Day = ReturnType<typeof useWeekHistory>["days"][number];
type Props = { days: Day[]; goalMs: number; active: number; onPick: (i: number) => void };

/** Calendar-style week: each session drawn at the hours it happened, day totals underneath. */
function WeekTimeline({ days, goalMs, active, onPick }: Props) {
  // Vertical range in hours after day start: fit the week's sessions, at least 6h, on even hours.
  const hours = days.flatMap((d) => d.spans.flatMap((s) => [(s.start - d.from) / HOUR, (s.end - d.from) / HOUR]));
  let lo = hours.length ? Math.floor(Math.min(...hours)) : 8;
  let hi = hours.length ? Math.ceil(Math.max(...hours)) : 18;
  lo -= lo % 2;
  hi = Math.min(24, Math.max(hi + (hi % 2), lo + 6));
  const y = (h: number) => `${((h - lo) / (hi - lo)) * 100}%`;
  // Keep full-day ranges legible while showing two-hour marks for typical days.
  const step = hi - lo > 16 ? 4 : 2;
  if ((hi - lo) % step) hi < 24 ? (hi += 2) : (lo -= 2);
  const ticks = Array.from({ length: (hi - lo) / step + 1 }, (_, i) => lo + i * step);

  // Hover cursor: which column and how far down (0–1) the mouse is.
  const [cursor, setCursor] = useState<{ col: number; fy: number } | null>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const col = Math.min(days.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * days.length)));
    setCursor({ col, fy });
  };
  const hoverAt = cursor && days[cursor.col].from + (lo + cursor.fy * (hi - lo)) * HOUR;
  const hit = cursor && days[cursor.col].spans.find((s) => hoverAt! >= s.start && hoverAt! < s.end);

  return (
    <>
      <div className="plot timeline" onMouseMove={onMove} onMouseLeave={() => setCursor(null)}>
        {ticks.map((t) => (
          <div key={t} className="grid" style={{ top: y(t) }}>
            <span>{fmtTime(days[0].from + t * HOUR)}</span>
          </div>
        ))}
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
              aria-label={`${fmtDate(d.date, { weekday: "long", month: "short", day: "numeric" })}: ${d.spans.length} sessions, ${fmtHM(d.ms)}`}
            >
              {d.spans.map((s) => (
                <span
                  key={s.start}
                  className="block"
                  data-hit={s === hit}
                  style={{ top: y((s.start - d.from) / HOUR), height: `max(2px, calc(${y((s.end - d.from) / HOUR)} - ${y((s.start - d.from) / HOUR)}))` }}
                />
              ))}
            </button>
          ))}
        </div>
        {cursor && (
          <div className="cursor" style={{ top: `${cursor.fy * 100}%` }} aria-hidden="true">
            <span className="cursor-time">{fmtTime(hoverAt!)}</span>
            {hit && (
              <span className="cursor-tip" data-edge={cursor.col < 2 ? "left" : cursor.col > 4 ? "right" : undefined} style={{ left: `${((cursor.col + 0.5) / days.length) * 100}%` }}>
                {fmtHM(hit.end - hit.start)} · {fmtTime(hit.start)}–{fmtTime(hit.end)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="xlabels" aria-hidden="true">
        {days.map((d, i) => (
          <span key={i} data-today={d.today} data-future={d.future}>
            {fmtDate(d.date, { weekday: "short" })}
          </span>
        ))}
      </div>
      <div className="xlabels totals" aria-hidden="true">
        {days.map((d, i) => (
          <span key={i} data-future={d.future}>{d.future ? "" : d.ms ? fmtHM(d.ms) : "–"}</span>
        ))}
      </div>
    </>
  );
}

export default WeekTimeline;
