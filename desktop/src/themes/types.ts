import type { ComponentType } from "react";

/**
 * The pill theme contract. A theme is a look; the shell (pill/PillWindow.tsx) owns behaviour.
 *
 * Rules every theme follows:
 * 1. It renders `m` only: no Tauri calls, no database, no timers, no effects.
 * 2. Its root is `<div className="pill" data-theme="<id>">`, and every selector in its CSS starts
 *    with `.pill[data-theme="<id>"]`. Keyframes and font families carry the theme id in their name.
 * 3. Every visual value is a CSS custom property on that root, light first, then
 *    `@media (prefers-color-scheme: dark)`. Future data-only user themes override them with a more
 *    specific selector the shell can provide, e.g.
 *    `.pill-shell[data-user-theme="dusk"] .pill[data-theme="instrument"] { --surface: … }`.
 * 4. Its only interactive elements are its own buttons, calling `m.toggle` and `m.openSettings`.
 *    Decorative parts are aria-hidden; the shell supplies the spoken status.
 * 5. It may ignore fields it doesn't show (Baseline ignores hold time).
 */

/** "long" once paused for the user's "Long pause after" setting; "none" while running. */
export type PauseLevel = "none" | "short" | "long";

export type PillModel = {
  elapsedMs: number; // today's total
  goalMs: number;
  progress: number; // elapsed / goal, clamped to 0..1
  running: boolean;
  done: boolean; // goal met today
  pausedMs: number; // hold time, 0 while running
  pause: PauseLevel;
  ready: boolean; // play is enabled
  showSettingsButton: boolean;
  toggle: () => void;
  openSettings: () => void;
};

export type PillTheme = {
  /** Stable: stored in settings. Renaming one needs a migration. */
  id: string;
  name: string;
  /** One line for the style picker. */
  blurb: string;
  /** Contract version. A breaking change to PillModel bumps it. */
  api: 1;
  /** Window width in CSS px, with and without the settings button. Height is always 48. */
  width: { withButton: number; bare: number };
  Pill: ComponentType<{ m: PillModel }>;
};
