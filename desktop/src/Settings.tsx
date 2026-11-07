import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { applyTheme, getTheme } from "./theme";
import HistoryChart from "./HistoryChart";
import "./Settings.css";

// ponytail: goal and day-start inputs are mock; wired to SQLite in the database step.

function Settings() {
  // Closing the window only hides it, so the pill can reopen it.
  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested((e) => {
      e.preventDefault();
      win.hide();
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  return (
    <main className="settings">
      <header>
        <h1>Settings</h1>
        <p>Hormozi Timer</p>
      </header>

      <section className="preferences" aria-labelledby="daily-heading">
        <h2 id="daily-heading">Daily rhythm</h2>
        <label className="row">
          <span className="row-copy"><span>Daily goal</span><small>Your minimum focused time.</small></span>
          <span className="field">
            <input aria-label="Daily goal in hours" type="number" defaultValue={4} min={0} max={24} step={0.5} />
            <span aria-hidden="true">h</span>
          </span>
        </label>
        <label className="row">
          <span className="row-copy"><span>Day starts at</span><small>When a new day begins.</small></span>
          <input aria-label="Day starts at" type="time" defaultValue="00:00" />
        </label>
      </section>

      <section className="preferences" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <div className="row">
          <span className="row-copy"><span id="theme-label">Theme</span><small>System follows your device.</small></span>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {(["system", "light", "dark"] as const).map((t) => (
              <label key={t}>
                <input type="radio" name="theme" className="sr-only" defaultChecked={getTheme() === t} onChange={() => applyTheme(t)} />
                <span>{t[0].toUpperCase() + t.slice(1)}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <HistoryChart />

      <button type="button" className="quit" onClick={() => invoke("quit")}>
        Quit Hormozi Timer
      </button>
    </main>
  );
}

export default Settings;
