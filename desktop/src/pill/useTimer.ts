import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { endBreak, heartbeat, lastBreak, lastSessionEnd, pauseSession, recoverOpenSession, sessionsBetween, STALE_MS, startBreak, startSession } from "../lib/db";
import { fixture } from "../lib/fixture";
import type { Settings } from "../lib/settings";
import { dayRange, holdMs, trimmedTotal, workDayOf } from "../lib/time";

const HEARTBEAT_MS = 30_000;

/** Today's finished sessions, trimmed to the work-day. The running one is added live. */
const finishedTotal = async (from: number, to: number) =>
  trimmedTotal((await sessionsBetween(from, to)).filter((s) => !s.open), from, to);

/** The timer engine: sessions in the DB, a 1s tick for the display, a 30s heartbeat. */
export function useTimer(settings: Settings, settingsLoaded: boolean) {
  const [recovered, setRecovered] = useState(false);
  const [baseMs, setBaseMs] = useState(0); // today's finished sessions
  const [openStart, setOpenStart] = useState<number | null>(null); // running session's start
  const [pausedSince, setPausedSince] = useState<number | null>(null); // end of the last session
  const [now, setNow] = useState(Date.now());
  const [launchedAt] = useState(Date.now);
  const [brk, setBrk] = useState<{ start: number; end: number } | null>(null); // the latest break
  const [synced, setSynced] = useState(0); // bump to re-read today's total from the DB
  const [saveFailed, setSaveFailed] = useState(false); // the last session write failed: the pill shows it
  const busy = useRef(false); // ignore double-clicks while a DB write is in flight
  const runningRef = useRef(false);
  const lastTick = useRef(Date.now());

  // Play stays disabled until we know the real goal/day-start and whether a session is open.
  const ready = recovered && settingsLoaded;
  const today = dayRange(workDayOf(new Date(now), settings.dayStart), settings.dayStart);
  const running = openStart !== null;
  runningRef.current = running;
  // A session that began before today's start only counts from the day boundary.
  const runningMs = running ? Math.max(0, now - Math.max(openStart, today.from)) : 0;
  const elapsed = baseMs + runningMs;
  const done = elapsed >= settings.dailyGoalMs;
  const pausedMs = running ? 0 : holdMs(now, pausedSince, today.from, launchedAt);
  const onBreak = !running && brk !== null && brk.start <= now && now < brk.end;
  // Rounded up to the second, so a 10 min break starts at 0:10:00 and ends at 0:00:01, never 0:00:00.
  const breakLeftMs = onBreak ? Math.ceil((brk.end - now) / 1000) * 1000 : 0;
  // A break that ended during this pause: the nagging counts from its end (lib/time.ts pauseLevel).
  const sinceBreakMs = !running && !onBreak && brk !== null && brk.end >= now - pausedMs ? now - brk.end : null;

  // On launch: resume a session still running from before a reload/restart,
  // otherwise remember when the last one ended so hold time survives the restart.
  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser: static pill
    (async () => {
      const open = await recoverOpenSession();
      setOpenStart(open?.start_ms ?? null);
      if (!open) setPausedSince(await lastSessionEnd());
      const b = await lastBreak(); // a restart mid-break carries on with it
      if (b) setBrk({ start: b.start_ms, end: b.end_ms });
      setRecovered(true);
    })().catch((e) => console.error("could not load timer", e));
  }, []);

  // (Re)load today's finished total on launch and whenever the work-day changes.
  useEffect(() => {
    if (!ready) return;
    finishedTotal(today.from, today.to)
      .then(setBaseMs)
      .catch((e) => console.error("could not load today's total", e));
  }, [ready, today.from, today.to, synced]);

  /**
   * Keep the running session's end fresh. If the DB finds it stale (the PC slept with the timer
   * on) it closes it at the last heartbeat, and the pill shows paused from that moment.
   */
  const beat = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const fresh = await heartbeat();
      setSaveFailed(false);
      if (!fresh) {
        setOpenStart(null);
        setPausedSince(await lastSessionEnd());
        setSynced((n) => n + 1);
      }
    } catch (e) {
      console.error("heartbeat failed", e);
      setSaveFailed(true);
    } finally {
      busy.current = false;
      setNow(Date.now());
    }
  };

  // Clock tick. Runs while paused too, so the display resets at the day boundary.
  // A long gap between ticks means the PC slept: check the session before showing the slept time.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      const slept = t - lastTick.current >= STALE_MS;
      lastTick.current = t;
      if (slept && runningRef.current) void beat();
      else if (!busy.current) setNow(t);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // While running, keep the session's end time fresh so a crash loses at most 30s.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [running]);

  /**
   * Write to the DB first, then update the screen, so the display never shows unsaved time.
   * Once the write succeeds the screen follows it, even if the total refresh after it fails:
   * showing "running" for a closed session would log nothing from then on.
   */
  const write = async (what: (t: number) => Promise<void>) => {
    if (busy.current || !ready) return;
    busy.current = true;
    const t = Date.now();
    try {
      await what(t);
      setSaveFailed(false);
    } catch (e) {
      console.error("could not save", e);
      setSaveFailed(true);
    } finally {
      busy.current = false;
      setNow(t);
    }
  };

  const pause = async (t: number) => {
    // Not written at t: the session went stale (slept) and was closed at its last heartbeat.
    const end = (await pauseSession(t)) ? t : ((await lastSessionEnd()) ?? t);
    setBaseMs((b) => b + Math.max(0, end - Math.max(openStart!, today.from)));
    setOpenStart(null);
    setPausedSince(end);
    // Re-read from the DB to correct any drift; the local sum above stands if this fails.
    finishedTotal(today.from, today.to)
      .then(setBaseMs)
      .catch((e) => console.error("could not refresh today's total", e));
  };

  const stopBreak = async (t: number) => {
    await endBreak(t);
    setBrk((b) => b && { ...b, end: t });
  };

  /** Play / pause. Starting work ends a running break. */
  const toggle = () =>
    write(async (t) => {
      if (running) return pause(t);
      if (onBreak) await stopBreak(t);
      await startSession(t);
      setOpenStart(t);
    });

  /** A planned break of `ms`. Pauses first if running; the break starts only once that is saved. */
  const takeBreak = (ms: number) =>
    write(async (t) => {
      if (running) await pause(t);
      await startBreak(t, ms);
      setBrk({ start: t, end: t + ms });
    });

  /** Back from a break early without starting work: the nagging picks up at nudge. */
  const endBreakNow = () => write(async (t) => (onBreak ? stopBreak(t) : undefined));

  // Screenshot harness (scripts/shots): fixed state, nothing to toggle.
  if (fixture) {
    const left = "breakLeftMs" in fixture ? fixture.breakLeftMs : 0;
    const idle = async () => {};
    return {
      elapsed: fixture.elapsedMs, running: fixture.running, done: fixture.elapsedMs >= settings.dailyGoalMs, pausedMs: fixture.pausedMs,
      onBreak: left > 0, breakLeftMs: left, sinceBreakMs: null, ready: true, saveFailed: false, toggle: idle, takeBreak: idle, endBreakNow: idle,
    };
  }

  return { elapsed, running, done, pausedMs, onBreak, breakLeftMs, sinceBreakMs, ready, saveFailed, toggle, takeBreak, endBreakNow };
}
