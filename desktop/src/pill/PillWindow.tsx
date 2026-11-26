import { useEffect, useRef } from "react";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { useSettings } from "../hooks/useSettings";
import { useWindowPosition } from "../hooks/useWindowPosition";
import { fmtClock, fmtHM, fmtTime } from "../lib/format";
import { pauseLevel } from "../lib/time";
import { quitApp } from "../lib/db";
import { fixture } from "../lib/fixture";
import { pillWidth, THEMES, themeById } from "../themes/registry";
import type { PillModel } from "../themes/types";
import { useAlarm } from "./useAlarm";
import { useAutoUpdate } from "./useAutoUpdate";
import { useAwakeLog } from "./useAwakeLog";
import { useCelebrate } from "./useCelebrate";
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

/** "Snooze reminders": how long a paused pill stays quiet. */
const SNOOZE_MS = 30 * 60_000;

/** How much bigger the alarm makes the pill. */
const ALARM_ZOOM = 1.5;

/** Shown (ring + tooltip + spoken) after a session write fails, until the next one succeeds. */
const SAVE_FAILED = "Couldn't save your time. Try again.";

/** What a screen reader hears; themes keep their own visuals aria-hidden. */
function spokenStatus(m: PillModel) {
  const today = `Today ${fmtClock(m.elapsedMs)}.`;
  if (m.done && m.elapsedMs < m.targetMs) return `${today} Daily goal met. ${fmtHM(m.targetMs - m.elapsedMs)} left on today's stretch.`;
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
  const { settings, loaded, save } = useSettings();
  const { elapsed, running, done, target, known, pausedMs, nag, away, quiet, restDay, dayEnd, onBreak, breakLeftMs, sinceBreakMs, ready, saveFailed, toggle, takeBreak, endBreakNow, stretch } = useTimer(settings, loaded);
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
    targetMs: target,
    progress: Math.min(1, elapsed / target),
    running,
    done,
    pausedMs,
    breakLeftMs,
    // Judged by `nag`: the pause, counted from a return to the PC or a quiet start of the day.
    pause: pauseLevel({ running, done: done || quiet, pausedMs: nag, onBreak, sinceBreakMs, away }, settings),
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
  // Goal (or today's stretch) met while working: confetti, a wiggle and a green flash.
  const celebrate = useCelebrate(elapsed, target, running, known);

  // No reminders until `until`: "Snooze" (30 min) or "Done for today" (to the day's end, pausing a running timer).
  const hush = (until: number) => void save("quiet_until", String(until), { ...settings, quietUntil: until });
  const snooze = () => hush(Date.now() + SNOOZE_MS);
  const doneToday = () => {
    if (running && ready) void toggle();
    hush(dayEnd);
  };

  // The tray's "Start / Pause". A ref, so the listener always calls the current toggle.
  const latest = useRef({ ...m, snooze, doneToday });
  latest.current = { ...m, snooze, doneToday };
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const unlisten = win.listen("tray-toggle", () => {
      if (latest.current.ready) latest.current.toggle();
    });
    // The tray's "Quit": close the running session first (lib.rs quits anyway if this hangs).
    const unlistenQuit = win.listen("tray-quit", () => void quitApp());
    const offs = [win.listen("tray-snooze", () => latest.current.snooze()), win.listen("tray-done", () => latest.current.doneToday())];
    return () => {
      unlisten.then((off) => off());
      unlistenQuit.then((off) => off());
      offs.forEach((o) => o.then((off) => off()));
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
    // Goal met: push some more today, whenever (the bubble only asks the moment it's met).
    const more = done && settings.stretchMs ? [{ text: `Push ${Math.round(settings.stretchMs / 60_000)} more min today`, enabled: ready, action: () => void stretch() }] : [];
    // Reminders: nothing to quiet once the goal is met. Quieted by hand: say until when, and undo.
    const snoozed = Date.now() < settings.quietUntil;
    const reminders = done ? [] : restDay ? [{ text: "Rest day: no reminders", enabled: false }]
      : snoozed ? [{ text: `${settings.quietUntil >= dayEnd ? "Done for today" : `Snoozed till ${fmtTime(settings.quietUntil)}`}: remind me again`, action: () => hush(0) }]
      : [{ text: "Snooze reminders 30 min", action: snooze }, { text: "Done for today", action: doneToday }];
    const sep = { item: "Separator" as const };
    Menu.new({ items: [...more, ...breaks, ...(reminders.length ? [sep, ...reminders] : []), sep, { text: "Settings", action: m.openSettings }] })
      .then((menu) => menu.popup())
      .catch((err) => console.error("could not open the pill menu", err));
  };

  if (!settled) return null;
  return (
    <div
      className="pill-shell" data-tauri-drag-region="deep" onContextMenu={onContextMenu}
      data-error={saveFailed || undefined} data-celebrate={celebrate || undefined} title={saveFailed ? SAVE_FAILED : undefined}
    >
      {/* Not a live region: it changes every second and would read the clock aloud nonstop. */}
      <span className="sr-only">{saveFailed && `${SAVE_FAILED} `}{spokenStatus(m)}</span>
      <theme.Pill m={m} />
    </div>
  );
}

export default PillWindow;
