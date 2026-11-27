import { useState } from "react";
import { fmtDate, fmtHM, fmtTime } from "../../lib/format";
import { HOUR } from "../../lib/time";
import type { useWeekHistory } from "./useWeekHistory";

type Day = ReturnType<typeof useWeekHistory>["days"][number];
type Props = { days: Day[]; active: number; onPick: (i: number) => void };

type Kind = "work" | "break" | "on";
const TIP: Record<Kind, string> = { work: "", break: "Break ", on: "PC on " };

/**
 * Calendar-style week: each session drawn at the hours it happened, day totals underneath.
 * Behind the sessions: when the PC was on (a pale band) and planned breaks (hatched).
 */
function WeekTimeline({ days, active, onPick }: Props) {
  // Vertical range in hours after day start: fit the week's sessions, at least 6h, on even hours.
  const hours = days.flatMap((d) => [...d.spans, ...d.on, ...d.breaks].flatMap((s) => [(s.start - d.from) / HOUR, (s.end - d.from) / HOUR]));
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
  // What's under the mouse: a session first, then a break, then PC-on time.
  const col = cursor && days[cursor.col];
  const hit = col
    ? ([["work", col.spans], ["break", col.breaks], ["on", col.on]] as const)
        .map(([kind, spans]) => ({ kind: kind as Kind, span: spans.find((s) => hoverAt! >= s.start && hoverAt! < s.end) }))
        .find((h) => h.span)
    : undefined;
  const place = (d: Day, s: { start: number; end: number }) => ({
    top: y((s.start - d.from) / HOUR),
    height: `max(2px, calc(${y((s.end - d.from) / HOUR)} - ${y((s.start - d.from) / HOUR)}))`,
  });

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
              data-met={d.ms >= d.goalMs}
              disabled={d.future}
              onMouseEnter={() => onPick(i)}
              onFocus={() => onPick(i)}
              aria-label={`${fmtDate(d.date, { weekday: "long", month: "short", day: "numeric" })}: ${d.spans.length} sessions, ${fmtHM(d.ms)}${d.onMs ? `, PC on ${fmtHM(d.onMs)}` : ""}`}
            >
              {d.on.map((s) => <span key={`on${s.start}`} className="on-band" style={place(d, s)} />)}
              {d.breaks.map((s) => <span key={`br${s.start}`} className="break-block" data-hit={s === hit?.span} style={place(d, s)} />)}
              {d.spans.map((s) => <span key={s.start} className="block" data-hit={s === hit?.span} style={place(d, s)} />)}
            </button>
          ))}
        </div>
        {cursor && (
          <div className="cursor" style={{ top: `${cursor.fy * 100}%` }} aria-hidden="true">
            <span className="cursor-time">{fmtTime(hoverAt!)}</span>
            {hit && (
              <span className="cursor-tip" data-edge={cursor.col < 2 ? "left" : cursor.col > 4 ? "right" : undefined} style={{ left: `${((cursor.col + 0.5) / days.length) * 100}%` }}>
                {TIP[hit.kind]}{fmtHM(hit.span!.end - hit.span!.start)} · {fmtTime(hit.span!.start)}–{fmtTime(hit.span!.end)}
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
      <Legend />
    </>
  );
}

/** Both views draw the same three things in the same colours. */
export const Legend = () => (
  <div className="legend" aria-hidden="true">
    <span><i className="block" />Focused</span>
    <span><i className="break-block" />Break</span>
    <span><i className="on-band" />PC on</span>
  </div>
);

export default WeekTimeline;
