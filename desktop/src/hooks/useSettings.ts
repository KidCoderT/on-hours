import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getSettings, setSetting } from "../lib/db";
import { fixture, fixtureSettings } from "../lib/fixture";
import { DEFAULT_SETTINGS, type SettingKey, type Settings } from "../lib/settings";

// Each window is its own JS runtime, so settings are shared through the DB
// plus a "settings-changed" event that tells every window to reload.
const CHANGED = "settings-changed";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...fixtureSettings }));
  const [loaded, setLoaded] = useState(fixture !== null); // harness: the defaults are the fixture
  // Reloads can overlap (startup + an event). Only the most recent one may land.
  const latest = useRef(0);

  const load = () => {
    const id = ++latest.current;
    return getSettings()
      .then((s) => {
        if (id !== latest.current) return;
        setSettings(s);
        setLoaded(true);
      })
      .catch((e) => console.error("could not load settings", e));
  };

  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser: defaults
    load();
    const unlisten = listen(CHANGED, load);
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  /** Show the new value now, save it, then tell the other windows. On failure, show what the DB holds. */
  const save = async (key: SettingKey, value: string, next: Settings) => {
    setSettings(next);
    if (!isTauri()) return;
    latest.current++; // a reload already in flight must not overwrite this newer value
    try {
      await setSetting(key, value);
      await emit(CHANGED);
    } catch (e) {
      console.error("could not save setting", key, e);
      await load();
    }
  };

  return { settings, loaded, save };
}
