# On Hours

A tiny always-on-top desktop timer that counts only the hours you actually work.

## The idea

One rule: **when you work, the timer is on. When you stop, it's off.**

Time spent "at your desk" is not time worked. On Hours counts only what happened while the timer
ran, so at the end of the day the number is honest. You set a daily minimum, and the pill tells
you at a glance where you stand: still short, on your way, or done.

## What it looks like

A small pill sits on top of every window. No window frame, no taskbar entry. It shows today's
total, a play/pause button, and your status against the daily goal.

Choose the pill's style in settings:

| Style | Look | Status shown by |
| --- | --- | --- |
| **Baseline** (default) | Clean, Mac-style panel | A traffic light: 🔴 paused, 🟡 working, 🟢 goal met |
| **Instrument** | Hardware readout with LCD digits | The digits themselves, plus how long you've been paused |
| **Ledger** | A line in an account book, in serif ink | Ink colour, plus a margin note with the pause length |

When a pause runs past your "Long pause after" setting (20 minutes by default), every style
escalates: Instrument and Ledger turn red, and Baseline's red light starts to bounce and pulse.
A long break can't go unnoticed.

## Features

- **Pill:** always on top, drag to move (position remembered), play/pause, today's total in `H:MM:SS`
- **Daily goal:** set your minimum; the pill turns green when you hit it
- **Pause tracking:** how long you've been paused survives an app restart
- **Settings window:** right-click the pill, its settings button, or the tray icon
  - **History:** this week as daily totals or a session timeline, with week-over-week change
  - **Preferences:** pill style, light/dark/system appearance, daily goal, when your day starts,
    first day of the week, long-pause threshold
  - The window takes on the colours and font of the pill style you pick
- **Tray icon:** Start / Pause, Show pill, Settings, Quit
- **Privacy:** optionally hide the pill from screen recordings and screen shares
- **Open at login**
- **Local only:** sessions are saved in SQLite on your machine, crash-safe (saved every 30s)

## Tech stack

- **Tauri v2** (Rust): native shell, windows, tray
- **React + TypeScript** (Vite): the pill and settings windows
- **SQLite** via `tauri-plugin-sql`: local session history
- **Fonts:** Inter (Baseline), DSEG7 and a mono face (Instrument), Source Serif 4 (Ledger), all bundled

## Repo layout

```
desktop/          Tauri app (the product)
  src/themes/     one folder per pill style; see themes/types.ts to add one
design/           design directions and plans
scripts/shots/    screenshot harness: every style, state and mode
```

## Development

```powershell
cd desktop
bun install
bun tauri dev
```

Other commands, from `desktop/`:

- `bun test`: database and time logic tests
- `bun run shots`: renders every pill style in every state to `scripts/shots/out`

App data lives in `%APPDATA%\com.tejas.on-hours`.

## Roadmap

- [ ] Windows installer and GitHub Releases
- [ ] Automatic updates
- [ ] Global hotkey to start/stop
- [ ] Landing page, online leaderboard, and a count of how many people are working live
- [ ] User CSS file for custom pill looks (plan in `design/PLAN_THEMES.md`)
- [ ] Idle detection (auto-pause when away)
- [ ] CSV export
- [ ] Small tasks widget

## Credit

The rule behind this app comes from Alex Hormozi: when you work, turn the timer on; when you stop,
turn it off. At the end of the day, the number doesn't lie.
