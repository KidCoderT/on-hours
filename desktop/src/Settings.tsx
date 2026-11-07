import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { applyTheme, getTheme } from "./theme";
import { getSettings, setSetting, type Settings as SettingsT } from "./db";
import HistoryChart from "./HistoryChart";
import "./Settings.css";

function Settings() {
  const [settings, setSettings] = useState<SettingsT>({ dailyGoalMs: 4 * 3_600_000, dayStart: "00:00" });
  const [goalText, setGoalText] = useState("4"); // what's typed, may be mid-edit like ""

  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser
    getSettings().then((s) => {
      setSettings(s);
      setGoalText(String(s.dailyGoalMs / 3_600_000));
    });
  }, []);

  // Save, then tell the pill to reload its settings.
  const save = async (key: "daily_goal_min" | "day_start", value: string, next: SettingsT) => {
    setSettings(next);
    if (!isTauri()) return;
    await setSetting(key, value);
    await emit("settings-changed");
  };

  const onGoal = (text: string) => {
    setGoalText(text);
    const h = Number(text);
    if (text === "" || !(h > 0 && h <= 24)) return; // keep typing; only valid values are saved
    const min = Math.round(h * 60);
    save("daily_goal_min", String(min), { ...settings, dailyGoalMs: min * 60_000 });
  };

  const onDayStart = (value: string) => {
    if (value) save("day_start", value, { ...settings, dayStart: value });
  };

  // Closing the window only hides it, so the pill can reopen it.
  useEffect(() => {
    if (!isTauri()) return;
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
            <input
              aria-label="Daily goal in hours" type="number" min={0.5} max={24} step={0.5}
              value={goalText} onChange={(e) => onGoal(e.target.value)}
            />
            <span aria-hidden="true">h</span>
          </span>
        </label>
        <label className="row">
          <span className="row-copy"><span>Day starts at</span><small>When a new day begins.</small></span>
          <input aria-label="Day starts at" type="time" value={settings.dayStart} onChange={(e) => onDayStart(e.target.value)} />
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

      <HistoryChart goalMs={settings.dailyGoalMs} dayStart={settings.dayStart} />

      <button type="button" className="quit" onClick={() => invoke("quit")}>
        Quit Hormozi Timer
      </button>
    </main>
  );
}

export default Settings;
