import { useEffect, useRef } from "react";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { useSettings } from "../hooks/useSettings";
import { useWindowPosition } from "../hooks/useWindowPosition";
import { fmtClock, fmtHM } from "../lib/format";
import { fixture } from "../lib/fixture";
import { pillWidth, THEMES, themeById } from "../themes/registry";
import type { PillModel } from "../themes/types";
import { useAutoUpdate } from "./useAutoUpdate";
import { useFitWindow } from "./useFitWindow";
import { useTimer } from "./useTimer";

async function openSettings() {
  const win = await Window.getByLabel("settings");
  await win?.unminimize();
  await win?.show();
  await win?.setFocus();
}

/** What a screen reader hears; themes keep their own visuals aria-hidden. */
function spokenStatus(m: PillModel) {
  const today = `Today ${fmtClock(m.elapsedMs)}.`;
  if (m.done) return `${today} Daily goal met.`;
  if (m.running) return `${today} Working, daily goal not met.`;
  return `${today} Paused for ${fmtHM(m.pausedMs)}, daily goal not met.`;
}

/**
 * The pill window's shell: timer, settings, window plumbing. The active theme only draws.
 * Right-click anywhere opens settings, whatever the theme and whether its button is shown.
 */
function PillWindow() {
  const { settings, loaded } = useSettings();
  const { elapsed, running, done, pausedMs, ready, toggle } = useTimer(settings, loaded);
  const theme = themeById(settings.pillTheme);
  const width = pillWidth(theme, settings.pillSettingsButton);
  // In the app, wait for the saved settings so the pill never flashes the default theme first.
  const settled = loaded || !isTauri();
  useWindowPosition();
  useFitWindow(width, loaded);
  useAutoUpdate(running);

  // Screenshot harness only: tell it the window width and the registered themes, so it can
  // size the viewport and fail when a theme overflows its declared width.
  useEffect(() => {
    if (!fixture) return;
    document.documentElement.dataset.pillWidth = String(width);
    document.documentElement.dataset.themes = THEMES.map((t) => t.id).join(" ");
  }, [width]);

  // Hide the pill from screen recordings / shares when turned off in settings.
  // useSettings reloads on "settings-changed", so this re-runs the moment the toggle flips.
  useEffect(() => {
    if (!isTauri() || !loaded) return;
    getCurrentWindow()
      .setContentProtected(!settings.showInRecordings)
      .catch((e) => console.error("could not change recording visibility", e));
  }, [loaded, settings.showInRecordings]);

  const m: PillModel = {
    elapsedMs: elapsed,
    goalMs: settings.dailyGoalMs,
    progress: Math.min(1, elapsed / settings.dailyGoalMs),
    running,
    done,
    pausedMs,
    pause: running ? "none" : pausedMs >= settings.longPauseMs ? "long" : "short",
    ready,
    showSettingsButton: settings.pillSettingsButton,
    toggle: () => void toggle(),
    openSettings: () => void openSettings().catch((e) => console.error("could not open settings", e)),
  };

  // The tray's "Start / Pause". A ref, so the listener always calls the current toggle.
  const latest = useRef(m);
  latest.current = m;
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = getCurrentWindow().listen("tray-toggle", () => {
      if (latest.current.ready) latest.current.toggle();
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    m.openSettings();
  };

  if (!settled) return null;
  return (
    <div className="pill-shell" data-tauri-drag-region="deep" onContextMenu={onContextMenu}>
      {/* Not a live region: it changes every second and would read the clock aloud nonstop. */}
      <span className="sr-only">{spokenStatus(m)}</span>
      <theme.Pill m={m} />
    </div>
  );
}

export default PillWindow;
