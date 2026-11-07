import { useEffect, useRef, useState } from "react";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";
import {
  dayRange, getSettings, heartbeat, pauseSession, recoverOpenSession,
  sessionsBetween, startSession, trimmedTotal, workDayOf, type Settings,
} from "./db";
import "./App.css";

const HEARTBEAT_MS = 30_000;

/** Today's finished sessions, trimmed to the work-day. The running one is added live. */
const finishedTotal = async (from: number, to: number) =>
  trimmedTotal((await sessionsBetween(from, to)).filter((s) => !s.open), from, to);

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

async function openSettings() {
  const win = await Window.getByLabel("settings");
  await win?.unminimize();
  await win?.show();
  await win?.setFocus();
}

function App() {
  const [settings, setSettings] = useState<Settings>({ dailyGoalMs: 4 * 3_600_000, dayStart: "00:00" });
  const [ready, setReady] = useState(false); // DB loaded; play is disabled until then
  const [baseMs, setBaseMs] = useState(0); // today's finished sessions
  const [openStart, setOpenStart] = useState<number | null>(null); // running session's start
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false); // ignore double-clicks while a DB write is in flight

  const today = dayRange(workDayOf(new Date(now), settings.dayStart), settings.dayStart);
  const running = openStart !== null;
  // A session that began before today's start only counts from the day boundary.
  const elapsed = baseMs + (running ? Math.max(0, now - Math.max(openStart, today.from)) : 0);
  const done = elapsed >= settings.dailyGoalMs;

  // On launch: load settings and resume a session still running from before a reload/restart.
  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser: static pill
    (async () => {
      setSettings(await getSettings());
      const open = await recoverOpenSession();
      setOpenStart(open?.start_ms ?? null);
      setReady(true);
    })().catch((e) => console.error("could not load timer", e));
  }, []);

  // The settings window saved a new goal / day start.
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen("settings-changed", () => getSettings().then(setSettings));
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  // (Re)load today's finished total on launch and whenever the work-day rolls over.
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

  // Save the pill's position shortly after each drag, so it survives a shutdown
  // (the plugin alone only saves on a clean quit).
  useEffect(() => {
    if (!isTauri()) return;

    let timer: ReturnType<typeof setTimeout>;
    const unlisten = getCurrentWindow().onMoved(() => {
      clearTimeout(timer);
      timer = setTimeout(() => saveWindowState(StateFlags.POSITION), 500);
    });

    return () => {
      clearTimeout(timer);
      unlisten.then((off) => off());
    };
  }, []);

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

  return (
    <div className="pill" data-running={running} data-done={done} data-tauri-drag-region="deep">
      <span className="dot" role="img" aria-label={done ? "Daily goal met" : running ? "Working, daily goal not met" : "Paused, daily goal not met"} />
      <span className="time" aria-label={"Today: " + fmt(elapsed)}>{fmt(elapsed)}</span>
      <span className="rule" aria-hidden="true" />
      <button type="button" onClick={toggle} disabled={!ready} aria-label={running ? "Pause" : "Start"}>
        {running ? (
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <rect x="4.6" y="3.5" width="2" height="9" rx="1" fill="currentColor" />
            <rect x="9.4" y="3.5" width="2" height="9" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M5.2 3.55c0-.5.54-.81.97-.55l6.05 4.43a.65.65 0 0 1 0 1.14L6.17 13c-.43.26-.97-.05-.97-.55V3.55Z" fill="currentColor" />
          </svg>
        )}
      </button>
      <button type="button" className="settings-btn" onClick={openSettings} aria-label="Settings">
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="M2.8 5.4h10.4M2.8 10.6h10.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
          <path d="M6.6 3.9v3M10.2 9.1v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default App;
