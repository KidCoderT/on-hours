import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./settings.css"; // before the chart's CSS, matching the original cascade order
import { useSettings } from "../../hooks/useSettings";
import { comboFromPress, showCombo } from "../../lib/hotkey";
import { DEFAULT_SETTINGS, LONG_PAUSE_MIN } from "../../lib/settings";
import { applyTheme, getTheme } from "../../lib/theme";
import HistoryChart from "../../components/history/HistoryChart";
import { themeById } from "../../themes/registry";
import StylePicker from "./StylePicker";

// Jan 7 2024 was a Sunday, so index 0 = Sunday, in the user's language.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: "long" }));

type SettingsApi = ReturnType<typeof useSettings>;

/**
 * A number field that may be mid-edit ("" or "1.") without saving. Shows the saved value once
 * settings load; saves only values `parse` accepts.
 */
function useNumberField(saved: number, loaded: boolean, parse: (text: string) => number | null, save: (n: number) => void) {
  const [text, setText] = useState(String(saved));
  useEffect(() => {
    if (loaded) setText(String(saved));
  }, [loaded]);
  const onChange = (next: string) => {
    setText(next);
    const n = parse(next);
    if (n !== null) save(n);
  };
  return [text, onChange] as const;
}

function PillPrefs({ settings, save }: SettingsApi) {
  const onButton = (on: boolean) => save("pill_settings_button", on ? "1" : "0", { ...settings, pillSettingsButton: on });
  const onRecordings = (show: boolean) =>
    save("show_in_recordings", show ? "1" : "0", { ...settings, showInRecordings: show });

  return (
    <section className="preferences" aria-labelledby="pill-heading">
      <h2 id="pill-heading">Pill</h2>
      <div className="row">
        <span className="row-copy"><span id="style-label">Style</span><small>How the pill looks.</small></span>
        <StylePicker value={settings.pillTheme} labelledBy="style-label" onPick={(id) => save("pill_theme", id, { ...settings, pillTheme: id })} />
      </div>
      <div className="row">
        <span className="row-copy"><span id="appearance-label">Appearance</span><small>System follows your device.</small></span>
        <div className="segmented" role="radiogroup" aria-labelledby="appearance-label">
          {(["system", "light", "dark"] as const).map((t) => (
            <label key={t}>
              <input type="radio" name="appearance" className="sr-only" defaultChecked={getTheme() === t} onChange={() => applyTheme(t)} />
              <span>{t[0].toUpperCase() + t.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="row">
        <span className="row-copy"><span>Settings button</span><small>Right-click the pill always opens settings.</small></span>
        <input type="checkbox" role="switch" className="switch" checked={settings.pillSettingsButton} onChange={(e) => onButton(e.target.checked)} />
      </label>
      <label className="row">
        <span className="row-copy"><span>Show in screen recordings</span><small>Off hides the pill from recordings and screen shares.</small></span>
        <input type="checkbox" role="switch" className="switch" checked={settings.showInRecordings} onChange={(e) => onRecordings(e.target.checked)} />
      </label>
    </section>
  );
}

function DailyRhythm({ settings, loaded, save }: SettingsApi) {
  const [goalText, onGoal] = useNumberField(
    settings.dailyGoalMs / 3_600_000,
    loaded,
    (t) => (t !== "" && Number(t) > 0 && Number(t) <= 24 ? Number(t) : null),
    (h) => {
      const min = Math.round(h * 60);
      save("daily_goal_min", String(min), { ...settings, dailyGoalMs: min * 60_000 });
    },
  );
  const [pauseText, onPause] = useNumberField(
    settings.longPauseMs / 60_000,
    loaded,
    (t) => (/^\d+$/.test(t) && Number(t) >= LONG_PAUSE_MIN.min && Number(t) <= LONG_PAUSE_MIN.max ? Number(t) : null),
    (min) => save("long_pause_min", String(min), { ...settings, longPauseMs: min * 60_000 }),
  );

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
          <input aria-label="Daily goal in hours" type="number" min={0.5} max={24} step={0.5} value={goalText} onChange={(e) => onGoal(e.target.value)} />
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
      <label className="row">
        <span className="row-copy"><span>Long pause after</span><small>When a paused pill turns red.</small></span>
        <span className="field">
          <input
            aria-label="Long pause after, in minutes" type="number" min={LONG_PAUSE_MIN.min} max={LONG_PAUSE_MIN.max} step={5}
            value={pauseText} onChange={(e) => onPause(e.target.value)}
          />
          <span aria-hidden="true">min</span>
        </span>
      </label>
    </section>
  );
}

/**
 * The global pause/resume key. Click it, press the new combo; Backspace turns it off, Esc cancels.
 * While recording the hotkey is released, otherwise Windows would deliver the current combo to
 * the shortcut instead of to this window, and it could never be chosen again.
 * Rust registers it and says why when it can't (another app owns it), so we only save what worked.
 */
function HotkeyRow({ settings, loaded, save }: SettingsApi) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");

  const apply = (combo: string) =>
    invoke("set_hotkey", { combo }).then(
      () => {
        setError("");
        return true;
      },
      (e) => {
        setError(String(e));
        return false;
      },
    );

  // Show right away if the saved combo can't be registered (e.g. another app took it since).
  useEffect(() => {
    if (isTauri() && loaded) void apply(settings.hotkey);
  }, [loaded, settings.hotkey]);

  const start = () => {
    setRecording(true);
    void apply(""); // release it; cancel() or a new choice puts a hotkey back
  };
  const cancel = () => {
    setRecording(false);
    void apply(settings.hotkey);
  };
  const choose = async (combo: string) => {
    if (await apply(combo)) save("hotkey", combo, { ...settings, hotkey: combo });
    else void apply(settings.hotkey); // e.g. taken by another app: keep the old one working
  };

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    if (e.key === "Escape") return cancel();
    const combo = e.key === "Backspace" ? "" : comboFromPress(e.nativeEvent);
    if (combo === null) return; // only modifiers so far
    setRecording(false);
    await choose(combo);
  };

  return (
    <div className="row">
      <span className="row-copy">
        <span id="hotkey-label">Pause / resume hotkey</span>
        <small className={error ? "row-error" : undefined} role={error ? "alert" : undefined}>
          {error || (recording ? "Press the new keys. Esc cancels, Backspace turns it off." : "Works from any app.")}
        </small>
      </span>
      <span className="hotkey-controls">
        {settings.hotkey !== DEFAULT_SETTINGS.hotkey && !recording && (
          <button type="button" className="hotkey-reset" onClick={() => void choose(DEFAULT_SETTINGS.hotkey)}>
            Reset
          </button>
        )}
        <button
          type="button" className="hotkey" aria-labelledby="hotkey-label" disabled={!isTauri()}
          onClick={start} onKeyDown={onKeyDown} onBlur={() => recording && cancel()}
        >
          {recording ? "Press keys…" : settings.hotkey ? showCombo(settings.hotkey) : "Off"}
        </button>
      </span>
    </div>
  );
}

function System(api: SettingsApi) {
  // Windows owns this setting (Settings → Apps → Startup), so we read it from there
  // instead of the DB: whatever Windows says is what the switch shows.
  const [autostart, setAutostart] = useState(false);
  const devBuild = import.meta.env.DEV; // never register the debug exe to run at login

  useEffect(() => {
    if (!isTauri()) return;
    const refresh = () => isEnabled().then(setAutostart).catch((e) => console.error("could not read autostart", e));
    refresh();
    // The window is hidden, not closed: re-check when it comes back, in case it was changed in Windows.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const onAutostart = async (on: boolean) => {
    try {
      await (on ? enable() : disable());
    } catch (e) {
      console.error("could not change autostart", e);
    }
    setAutostart(await isEnabled()); // show what Windows actually did
  };

  return (
    <section className="preferences" aria-labelledby="system-heading">
      <h2 id="system-heading">System</h2>
      <label className="row">
        <span className="row-copy">
          <span>Open at login</span>
          <small>{devBuild ? "Available in the installed app." : "Start the timer when you sign in to Windows."}</small>
        </span>
        <input
          type="checkbox" role="switch" className="switch" disabled={devBuild || !isTauri()}
          checked={autostart} onChange={(e) => onAutostart(e.target.checked)}
        />
      </label>
      <HotkeyRow {...api} />
    </section>
  );
}

function SettingsWindow() {
  const settingsApi = useSettings();
  const { settings } = settingsApi;
  const appTheme = themeById(settings.pillTheme).id;

  // Like an editor theme: the pill style also sets this window's colours and font, never its layout.
  // The palettes live in themes/<id>/app.css; with none set, the app's own tokens apply.
  useEffect(() => {
    document.documentElement.dataset.appTheme = appTheme;
  }, [appTheme]);

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

  // The record first, preferences after: you open this window to see how the week went.
  return (
    <main className="settings">
      <header>
        <h1>On Hours</h1>
      </header>

      <HistoryChart goalMs={settings.dailyGoalMs} dayStart={settings.dayStart} weekStart={settings.weekStart} />

      <h2 className="back-matter">Preferences</h2>
      <PillPrefs {...settingsApi} />
      <DailyRhythm {...settingsApi} />
      <System {...settingsApi} />

      <button type="button" className="quit" onClick={() => invoke("quit")}>
        Quit On Hours
      </button>
    </main>
  );
}

export default SettingsWindow;
