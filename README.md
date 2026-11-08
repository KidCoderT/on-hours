# Hormozi Timer

A tiny always-on-top desktop timer for logging real work.

Inspired by Alex Hormozi's rule: **when you work, turn the timer on. When you stop, turn it off.** At the end of the day, the number doesn't lie.

The app is a small pill that sits on your screen like a desktop pet: no window frame, no taskbar entry. It shows today's total, has a play/pause button, and a status dot that tells you where you stand against your daily minimum.

| Dot | Meaning |
| --- | --- |
| 🔴 Red | Paused, goal not met |
| 🟡 Yellow | Running, goal not met |
| 🟢 Green | Goal met (running or paused) |

## Tech stack

- **Tauri v2** (Rust): native shell, windows, tray
- **React + TypeScript** (Vite): UI for the pill and settings windows
- **SQLite** via `tauri-plugin-sql`: local session history
- **Inter**: bundled font

## Repo layout

```
hormozi-timer/
├─ desktop/   Tauri app (the product)
├─ web/       Landing page (later)
└─ design/    UI mockups (design/pill.html is the final pill)
```

## Features / TODO

### MVP

- [x] Pill window: frameless, transparent, always on top, hidden from taskbar
- [x] Drag to move; position remembered between launches
- [x] Play/pause toggle; today's total in `H:MM:SS`
- [x] Status dot (red / yellow / green) with pulse while running
- [x] Light and dark theme (follows Windows, can be overridden)
- [x] Sessions saved to SQLite; crash-safe (end time saved every 30s)
- [x] Daily minimum goal (set in settings)
- [ ] Make it configurable so screen recorders cannot see it
- [ ] Configurable day start (default midnight); sessions split at the boundary
- [ ] Settings window: goal, day start, theme, last 30 days history
- [ ] Tray icon: Settings, Quit
- [ ] Windows installer build
- [ ] Launch on startup
- [x] History charts / heatmap

### Later

- [ ] Global hotkey to start/stop
- [ ] Idle detection (auto-pause when away)
- [ ] CSV export
- [ ] Landing page (`web/`)
- [ ] Online leaderboard shown on website
- [ ] a number showing how many live studying

## Development

```powershell
cd desktop
bun install
bun tauri dev
```
