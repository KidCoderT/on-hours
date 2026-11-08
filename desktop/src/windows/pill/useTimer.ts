import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { heartbeat, lastSessionEnd, pauseSession, recoverOpenSession, sessionsBetween, startSession, type Settings } from "../../lib/db";
import { fixture } from "../../lib/fixture";
import { dayRange, trimmedTotal, workDayOf } from "../../lib/time";

const HEARTBEAT_MS = 30_000;

/** Today's finished sessions, trimmed to the work-day. The running one is added live. */
const finishedTotal = async (from: number, to: number) =>
  trimmedTotal((await sessionsBetween(from, to)).filter((s) => !s.open), from, to);

/** The timer engine: sessions in the DB, a 1s tick for the display, a 30s heartbeat. */
export function useTimer(settings: Settings, settingsLoaded: boolean) {
  const [recovered, setRecovered] = useState(false);
  const [baseMs, setBaseMs] = useState(0); // today's finished sessions
  const [openStart, setOpenStart] = useState<number | null>(null); // running session's start
  const [pausedSince, setPausedSince] = useState<number | null>(null); // last pause, for "paused for how long"
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false); // ignore double-clicks while a DB write is in flight

  // Play stays disabled until we know the real goal/day-start and whether a session is open.
  const ready = recovered && settingsLoaded;
  const today = dayRange(workDayOf(new Date(now), settings.dayStart), settings.dayStart);
  const running = openStart !== null;
  // A session that began before today's start only counts from the day boundary.
  const elapsed = baseMs + (running ? Math.max(0, now - Math.max(openStart, today.from)) : 0);
  const done = elapsed >= settings.dailyGoalMs;
  const pausedMs = running || pausedSince === null ? 0 : Math.max(0, now - pausedSince);

  // On launch: resume a session still running from before a reload/restart.
  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser: static pill
    recoverOpenSession()
      .then(async (open) => {
        setOpenStart(open?.start_ms ?? null);
        if (!open) setPausedSince(await lastSessionEnd());
        setRecovered(true);
      })
      .catch((e) => console.error("could not load timer", e));
  }, []);

  // (Re)load today's finished total on launch and whenever the work-day changes.
  useEffect(() => {
    if (ready) finishedTotal(today.from, today.to).then(setBaseMs);
  }, [ready, today.from, today.to]);

  // Clock tick. Runs while paused too, so the display resets at the day boundary.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // While running, keep the session's end time fresh so a crash loses at most 30s.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => heartbeat(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [running]);

  // Write to the DB first, then update the screen, so the display never shows unsaved time.
  const toggle = async () => {
    if (busy.current) return;
    busy.current = true;
    const t = Date.now();
    try {
      if (running) {
        await pauseSession(t);
        setBaseMs(await finishedTotal(today.from, today.to));
        setOpenStart(null);
        setPausedSince(t);
      } else {
        await startSession(t);
        setOpenStart(t);
      }
      setNow(t);
    } catch (e) {
      console.error("could not save session", e);
    } finally {
      busy.current = false;
    }
  };

  // Screenshot harness (scripts/shots): fixed state, nothing to toggle.
  if (fixture) {
    return { elapsed: fixture.elapsedMs, running: fixture.running, done: fixture.elapsedMs >= settings.dailyGoalMs, pausedMs: fixture.pausedMs, ready: true, toggle: async () => {} };
  }

  return { elapsed, running, done, pausedMs, ready, toggle };
}
