import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { firstSessionStart, sessionsBetween, type Session } from "../../lib/db";
import { addDays, dayRange, weekStartOf, startOfDay, trimmedTotal, WEEK, workDayOf } from "../../lib/time";

/** Worked time per day for the week `offset` weeks back, plus the week before it for deltas. */
export function useWeekHistory(offset: number, dayStart: string, weekStart: number) {
  const today = startOfDay(workDayOf(new Date(), dayStart));
  const thisWeekStart = weekStartOf(today, weekStart);
  const first = addDays(thisWeekStart, -7 * offset);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [maxOffset, setMaxOffset] = useState(0); // can't page back past the first session

  // Load this week plus the week before it (for "vs last week / vs yesterday").
  const from = dayRange(addDays(first, -7), dayStart).from;
  const to = dayRange(addDays(first, 6), dayStart).to;

  useEffect(() => {
    if (!isTauri()) return; // design preview: empty chart
    const load = () => {
      sessionsBetween(from, to).then(setSessions);
      firstSessionStart().then((t) => setMaxOffset(t ? Math.round((+thisWeekStart - +weekStartOf(new Date(t), weekStart)) / WEEK) : 0));
    };
    load();
    // The settings window is hidden, not closed, so refresh each time it's brought back.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [from, to, +thisWeekStart]);

  // ponytail: a running session counts up to "now" but only refreshes on focus / paging; add a timer if a live chart matters.
  const now = Date.now();
  const live = sessions.map((s) => (s.open ? { ...s, end_ms: now } : s));
  const worked = (date: Date) => {
    const r = dayRange(date, dayStart);
    return trimmedTotal(live, r.from, r.to);
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(first, i);
    const { from, to } = dayRange(date, dayStart);
    // Each session's slice of this day, for the timeline view.
    const spans = live
      .filter((s) => s.end_ms > from && s.start_ms < to)
      .map((s) => ({ start: Math.max(s.start_ms, from), end: Math.min(s.end_ms, to) }));
    return { date, from, spans, ms: worked(date), future: date > today, today: +date === +today };
  });

  // Week total vs the same number of days last week (fair for a week in progress).
  const elapsed = days.filter((d) => !d.future).length;
  const total = days.reduce((s, d) => s + d.ms, 0);
  const prevTotal = days.slice(0, elapsed).reduce((s, d) => s + worked(addDays(d.date, -7)), 0);
  const weekPct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return { first, days, elapsed, total, weekPct, maxOffset, worked };
}
