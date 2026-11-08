import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import "./settings.css"; // before the chart's CSS, matching the original cascade order
import { useSettings } from "../../hooks/useSettings";
import { applyTheme, getTheme } from "../../lib/theme";
import HistoryChart from "../../components/history/HistoryChart";

// Jan 7 2024 was a Sunday, so index 0 = Sunday, in the user's language.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: "long" }));

type SettingsApi = ReturnType<typeof useSettings>;

function DailyRhythm({ settings, loaded, save }: SettingsApi) {
  const [goalText, setGoalText] = useState("4"); // what's typed, may be mid-edit like ""

  // Fill the field once the saved goal arrives.
  useEffect(() => {
    if (loaded) setGoalText(String(settings.dailyGoalMs / 3_600_000));
  }, [loaded]);

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

  const onWeekStart = (value: string) => save("week_start", value, { ...settings, weekStart: Number(value) });

  return (
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
      <label className="row">
        <span className="row-copy"><span>Week starts on</span><small>First column of the history chart.</small></span>
        <select aria-label="Week starts on" value={settings.weekStart} onChange={(e) => onWeekStart(e.target.value)}>
          {WEEKDAYS.map((name, i) => <option key={i} value={i}>{name}</option>)}
        </select>
      </label>
    </section>
  );
}

function Appearance() {
  return (
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
  );
}

function SettingsWindow() {
  const settingsApi = useSettings();

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

      <DailyRhythm {...settingsApi} />
      <Appearance />
      <HistoryChart goalMs={settingsApi.settings.dailyGoalMs} dayStart={settingsApi.settings.dayStart} weekStart={settingsApi.settings.weekStart} />

      <button type="button" className="quit" onClick={() => invoke("quit")}>
        Quit Hormozi Timer
      </button>
    </main>
  );
}

export default SettingsWindow;
