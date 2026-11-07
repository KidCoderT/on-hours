import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { DEFAULT_SETTINGS, getSettings, setSetting, type Settings } from "../lib/db";

// Each window is its own JS runtime, so settings are shared through the DB
// plus a "settings-changed" event that tells every window to reload.
const CHANGED = "settings-changed";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser: defaults
    const load = () =>
      getSettings()
        .then((s) => {
          setSettings(s);
          setLoaded(true);
        })
        .catch((e) => console.error("could not load settings", e));
    load();
    const unlisten = listen(CHANGED, load);
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  /** Show the new value now, save it, then tell the other windows. */
  const save = async (key: "daily_goal_min" | "day_start", value: string, next: Settings) => {
    setSettings(next);
    if (!isTauri()) return;
    await setSetting(key, value);
    await emit(CHANGED);
  };

  return { settings, loaded, save };
}
