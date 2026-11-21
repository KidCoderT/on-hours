import { useEffect, useRef } from "react";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { useSettings } from "../hooks/useSettings";
import { useWindowPosition } from "../hooks/useWindowPosition";
import { fmtClock, fmtHM } from "../lib/format";
import { pauseLevel } from "../lib/time";
import { quitApp } from "../lib/db";
import { fixture } from "../lib/fixture";
import { pillWidth, THEMES, themeById } from "../themes/registry";
import type { PillModel } from "../themes/types";
import { useAlarm } from "./useAlarm";
import { useAutoUpdate } from "./useAutoUpdate";
import { useAwakeLog } from "./useAwakeLog";
import { useFitWindow } from "./useFitWindow";
import { useTimer } from "./useTimer";

async function openSettings() {
  const win = await Window.getByLabel("settings");
  await win?.unminimize();
  await win?.show();
  await win?.setFocus();
}

/** The right-click menu's break lengths, in minutes. */
const BREAKS = [10, 15, 30];

/** How much bigger the alarm makes the pill. */
const ALARM_ZOOM = 1.5;

/** Shown (ring + tooltip + spoken) after a session write fails, until the next one succeeds. */
const SAVE_FAILED = "Couldn't save your time. Try again.";

/** What a screen reader hears; themes keep their own visuals aria-hidden. */
function spokenStatus(m: PillModel) {
  const today = `Today ${fmtClock(m.elapsedMs)}.`;
  if (m.done) return `${today} Daily goal met.`;
  if (m.running) return `${today} Working, daily goal not met.`;
  if (m.pause === "break") return `${today} On a break, ${fmtHM(m.breakLeftMs)} left.`;
  return `${today} Paused for ${fmtHM(m.pausedMs)}, daily goal not met.`;
}

/**
 * The pill window's shell: timer, settings, window plumbing. The active theme only draws.
 * Right-click anywhere opens a menu (breaks, settings), whatever the theme and whether its button is shown.
 */
function PillWindow() {
  const { settings, loaded } = useSettings();
  const { elapsed, running, done, pausedMs, onBreak, breakLeftMs, sinceBreakMs, ready, saveFailed, toggle, takeBreak, endBreakNow } = useTimer(settings, loaded);
  const theme = themeById(settings.pillTheme);
  const width = pillWidth(theme, settings.pillSettingsButton);
  // In the app, wait for the saved settings so the pill never flashes the default theme first.
  const settled = loaded || !isTauri();
  useWindowPosition();
  useAwakeLog();
  // Updates restart the app: wait for a long pause, not a quick break.
  useAutoUpdate(!running && pausedMs >= settings.longPauseMs);

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
    breakLeftMs,
    pause: pauseLevel({ running, done, pausedMs, onBreak, sinceBreakMs }, settings),
    ready,
    showSettingsButton: settings.pillSettingsButton,
    toggle: () => void toggle(),
    openSettings: () => void openSettings().catch((e) => console.error("could not open settings", e)),
  };

  // The alarm stage: the pill grows, shakes and flashes its taskbar button. App only: in the
  // screenshot harness the window can't grow, so the pill is drawn at its normal size.
  const alarm = m.pause === "alarm" && isTauri();
  useFitWindow(width, loaded, alarm ? ALARM_ZOOM : 1);
  useAlarm(alarm);

  // The tray's "Start / Pause". A ref, so the listener always calls the current toggle.
  const latest = useRef(m);
  latest.current = m;
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const unlisten = win.listen("tray-toggle", () => {
      if (latest.current.ready) latest.current.toggle();
    });
    // The tray's "Quit": close the running session first (lib.rs quits anyway if this hangs).
    const unlistenQuit = win.listen("tray-quit", () => void quitApp());
    return () => {
      unlisten.then((off) => off());
      unlistenQuit.then((off) => off());
    };
  }, []);

  // The global hotkey lives in Rust; keep it on the saved combo. A failure (another app owns
  // the combo) is shown in Settings, where the same call is made.
  useEffect(() => {
    if (!isTauri() || !loaded) return;
    invoke("set_hotkey", { combo: settings.hotkey }).catch((e) => console.error("hotkey not registered", e));
  }, [loaded, settings.hotkey]);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isTauri()) return;
    const breaks = onBreak
      ? [{ text: "End break", action: () => void endBreakNow() }]
      : BREAKS.map((min) => ({ text: `Take a ${min} min break`, enabled: ready, action: () => void takeBreak(min * 60_000) }));
    Menu.new({ items: [...breaks, { item: "Separator" as const }, { text: "Settings", action: m.openSettings }] })
      .then((menu) => menu.popup())
      .catch((err) => console.error("could not open the pill menu", err));
  };

  if (!settled) return null;
  return (
    <div
      className="pill-shell" data-tauri-drag-region="deep" onContextMenu={onContextMenu}
      data-error={saveFailed || undefined} title={saveFailed ? SAVE_FAILED : undefined}
      style={alarm ? { zoom: ALARM_ZOOM } : undefined}
    >
      {/* Not a live region: it changes every second and would read the clock aloud nonstop. */}
      <span className="sr-only">{saveFailed && `${SAVE_FAILED} `}{spokenStatus(m)}</span>
      <theme.Pill m={m} />
    </div>
  );
}

export default PillWindow;
