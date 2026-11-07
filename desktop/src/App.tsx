import { useEffect, useState } from "react";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";
import "./App.css";

// ponytail: hardcoded until settings are saved to the database.
const GOAL_MS = 4 * 60 * 60 * 1000;

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
  const [start, setStart] = useState(Date.now());
  const [clock, setClock] = useState(0);
  const [running, setRunning] = useState(false);

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

  useEffect(() => {
    if (!running) return;
    // note: setInterval runs every second until it's cleared
    const id = setInterval(() => setClock(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [start, running]); // no `clock` here: the effect only writes it, never reads it

  const toggle = () => {
    if (running) setClock(Date.now() - start); // pausing: save the exact time
    else setStart(Date.now() - clock); // resuming: continue from where we left off
    setRunning(!running);
  };

  const done = clock >= GOAL_MS;

  return (
    <div className="pill" data-running={running} data-done={done} data-tauri-drag-region="deep">
      <span className="dot" role="img" aria-label={done ? "Daily goal met" : running ? "Working, daily goal not met" : "Paused, daily goal not met"} />
      <span className="time" aria-label={"Today: " + fmt(clock)}>{fmt(clock)}</span>
      <span className="rule" aria-hidden="true" />
      <button type="button" onClick={toggle} aria-label={running ? "Pause" : "Start"}>
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
