import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { awakeBetween, breaksBetween, extrasBetween, firstSessionStart, goalsBetween, sessionsBetween, STALE_MS, type Session } from "../../lib/db";
import { fixture, fixtureAwake, fixtureBreaks, fixtureSessions } from "../../lib/fixture";
import { addDays, dayRange, weekStartOf, startOfDay, trimmedTotal, WEEK, workDayOf } from "../../lib/time";

type Span = { start_ms: number; end_ms: number };

/** Each span's slice of [from, to), for the timeline. */
const slices = (spans: Span[], from: number, to: number) =>
  spans.filter((s) => s.end_ms > from && s.start_ms < to).map((s) => ({ start: Math.max(s.start_ms, from), end: Math.min(s.end_ms, to) }));

/**
 * Worked time per day for the week `offset` weeks back, plus the week before it for deltas.
 * Also when the PC was on, the planned breaks, and any stretch past the goal.
 */
export function useWeekHistory(offset: number, dayStart: string, weekStart: number, restDays: number[] = [], goalMs = 0) {
  const today = startOfDay(workDayOf(new Date(), dayStart));
  const thisWeekStart = weekStartOf(today, weekStart);
  const first = addDays(thisWeekStart, -7 * offset);
  const [sessions, setSessions] = useState<Session[]>(() => (fixture ? fixtureSessions(Date.now()) : []));
  const [awake, setAwake] = useState<Span[]>(() => (fixture ? fixtureAwake(Date.now()) : []));
  const [breaks, setBreaks] = useState<Span[]>(() => (fixture ? fixtureBreaks(Date.now()) : []));
  const [extras, setExtras] = useState<Map<number, number>>(() => new Map()); // each day's stretch, by its date
  const [goals, setGoals] = useState<Map<number, number>>(() => new Map()); // the goal each day was judged against, by its date
  const [failed, setFailed] = useState(false); // a load failed: the chart says so, with a retry
  const [loads, setLoads] = useState(0); // bump to load again (a retry, a hand edit)
  const [maxOffset, setMaxOffset] = useState(fixture ? 1 : 0); // can't page back past the first session

  // Load this week plus the week before it (for "vs last week / vs yesterday").
  const from = dayRange(addDays(first, -7), dayStart).from;
  const to = dayRange(addDays(first, 6), dayStart).to;

  useEffect(() => {
    if (!isTauri()) return; // design preview: empty chart
    // Paging fast starts several loads; only this week's may land, or the chart shows another week.
    let alive = true;
    const fail = (e: unknown) => {
      console.error("could not load history", e);
      if (alive) setFailed(true);
    };
    const load = () => {
      setFailed(false);
      goalsBetween(from, to)
        .then((g) => alive && setGoals(g))
        .catch(fail);
      sessionsBetween(from, to)
        .then((s) => alive && setSessions(s))
        .catch(fail);
      awakeBetween(from, to)
        .then((s) => alive && setAwake(s))
        .catch(fail);
      breaksBetween(from, to)
        .then((s) => alive && setBreaks(s))
        .catch(fail);
      extrasBetween(from, to)
        .then((x) => alive && setExtras(x))
        .catch(fail);
      firstSessionStart()
        .then((t) => alive && setMaxOffset(t ? Math.round((+thisWeekStart - +weekStartOf(startOfDay(workDayOf(new Date(t), dayStart)), weekStart)) / WEEK) : 0))
        .catch(fail);
    };
    load();
    // The settings window is hidden, not closed, so refresh each time it's brought back.
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, [from, to, +thisWeekStart, dayStart, loads]);

  // ponytail: a running session counts up to "now" but only refreshes on focus / paging; add a timer if a live chart matters.
  const now = Date.now();
  const live = sessions.map((s) => (s.open ? { ...s, end_ms: now } : s));
  // The current PC-on stretch runs to now; a running break shows only what has passed.
  const awakeLive = awake.map((s) => (now - s.end_ms < STALE_MS ? { ...s, end_ms: now } : s));
  const breaksLive = breaks.map((s) => (s.end_ms > now ? { ...s, end_ms: Math.max(s.start_ms, now) } : s));
  const worked = (date: Date) => {
    const r = dayRange(date, dayStart);
    return trimmedTotal(live, r.from, r.to);
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(first, i);
    const { from, to } = dayRange(date, dayStart);
    return {
      date, from, ms: worked(date), future: date > today, today: +date === +today, rest: restDays.includes(date.getDay()),
      spans: slices(live, from, to),
      on: slices(awakeLive, from, to),
      breaks: slices(breaksLive, from, to),
      onMs: trimmedTotal(awakeLive, from, to),
      breakMs: trimmedTotal(breaksLive, from, to),
      extraMs: extras.get(+date) ?? 0, // a stretch said yes to: the goal plus this, just that day
      goalMs: goals.get(+date) ?? goalMs, // what the day was judged against; before goals were kept, today's
    };
  });

  // Week total vs the same number of days last week (fair for a week in progress).
  const elapsed = days.filter((d) => !d.future).length;
  const total = days.reduce((s, d) => s + d.ms, 0);
  const prevTotal = days.slice(0, elapsed).reduce((s, d) => s + worked(addDays(d.date, -7)), 0);
  const weekPct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const reload = () => setLoads((n) => n + 1);
  return { first, days, elapsed, total, weekPct, maxOffset, worked, sessions, failed, reload };
}
