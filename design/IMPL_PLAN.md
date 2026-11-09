# Implementation plan: pill themes + reorganised settings

Product decisions are in `design/PLAN_THEMES.md`. This file is the code plan.
Branch: `feat/pill-themes`, from `feat/polish-ui` (the shared base).

Decisions taken as defaults (user did not object):
- Hold time survives an app restart within the same day.
- Default pill style for new installs and existing installs: `baseline`.

Goals, in priority order: **robust** (no lost time, no broken window), **clean** (small files, one
owner per concern), **extensible** (adding a theme is one folder plus one registry line).
Non-goals now: user theme files, tray icon, per-theme settings window, theme accent in the chart.

## 0. Sources

| What | Where |
| --- | --- |
| Baseline pill + settings + chart | this branch, `desktop/src` |
| Instrument pill | `../hormozi-timer-instrument/desktop/src/windows/pill/*`, `components/Seg.tsx`, `styles/tokens.css`, `assets/fonts/*` |
| Ledger pill | `../hormozi-timer-ledger/desktop/src/windows/pill/*`, `styles/tokens.css`, `components/icons.tsx` (BookIcon), `@fontsource-variable/source-serif-4` |
| Ledger settings order + memo line | `../hormozi-timer-ledger/desktop/src/windows/settings/*`, `components/history/HistoryChart.tsx` |

Only the pill code and the memo line are taken from the design branches. Their history charts,
global token rewrites, and `main.tsx` changes are not.

## 1. File layout after the change

```
desktop/src/
  main.tsx                         unchanged except: pill window renders pill/PillWindow
  lib/
    db.ts                          + 3 settings fields, + lastSessionEnd (exists)
    time.ts                        + holdMs(now, lastPause, dayFrom) — pure
    format.ts                      + fmtHMM ("4:05"), replaces fmtDur/fmtLedger from the branches
    fixture.ts                     + theme/button overrides for the harness
  hooks/useSettings.ts             unchanged API; fixture defaults include overrides
  pill/
    PillWindow.tsx                 the shell (section 3)
    useTimer.ts                    moved from windows/pill, hold-time rule from section 2
    useFitWindow.ts                resize to theme width, right edge anchored (section 4)
  themes/
    types.ts                       PillModel, PillThemeManifest
    registry.ts                    THEMES, themeById(), DEFAULT_THEME
    baseline/   Pill.tsx pill.css preview-light.png preview-dark.png
    instrument/ Pill.tsx pill.css Seg.tsx fonts/*.woff2 fonts/*-OFL.txt preview-*.png
    ledger/     Pill.tsx pill.css preview-*.png
  windows/settings/
    SettingsWindow.tsx             reordered (section 6)
    StylePicker.tsx                new, ~40 lines
    settings.css                   + section heading style, picker style
  components/history/              baseline chart, + memo line
src-tauri/
  migrations/0004_pill_theme.sql   new
  src/lib.rs                       register migration 4
  capabilities/default.json        + set-size, set-position
```

`windows/pill/` is deleted (moved to `pill/`).

## 2. Engine

`lib/time.ts`:
```ts
/** Paused time: from the later of the last pause and today's day start. Never negative. */
export const holdMs = (now: number, lastPause: number | null, dayFrom: number) =>
  Math.max(0, now - Math.max(lastPause ?? dayFrom, dayFrom));
```
`pill/useTimer.ts`: `pausedSince` is set from `lastSessionEnd()` on launch when no session is open,
and to `t` on pause (already the case on this branch). `pausedMs = running ? 0 : holdMs(now, pausedSince, today.from)`.
Returns `{ elapsed, running, done, pausedMs, ready, toggle }` as today.

Tests in `tests/db.test.ts`: yesterday's pause counts from day start; today's pause counts from the
pause; restart mid-pause keeps the count (same inputs, so same output); null last pause counts from day start.

## 3. Theme contract

```ts
// themes/types.ts
export type PauseLevel = "none" | "short" | "long";
export type PillModel = {
  elapsedMs: number; goalMs: number; progress: number;   // progress 0..1
  running: boolean; done: boolean;
  pausedMs: number; pause: PauseLevel;                     // "none" while running
  ready: boolean; showSettingsButton: boolean;
  toggle: () => void; openSettings: () => void;
};
export type PillThemeManifest = {
  id: string; name: string; blurb: string;
  width: { withButton: number; bare: number };             // px, height is always 48
  Pill: React.LazyExoticComponent<React.ComponentType<{ m: PillModel }>>;
};
```

`themes/registry.ts`:
```ts
export const THEMES = [baseline, instrument, ledger] satisfies PillThemeManifest[];
export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME = "baseline";
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]; // unknown id → baseline
```
Manifests are static objects in `registry.ts`; `Pill` is `lazy(() => import("./<id>/Pill"))`, so the
picker and the window sizing never load theme code.

Theme rules (enforced by review, written at the top of `types.ts`):
1. A theme renders `m` only. No Tauri, DB, timers, or `useEffect`.
2. Root element: `<div className="pill" data-theme="<id>">`. Every selector in its CSS starts with
   `.pill[data-theme="<id>"]`. Its tokens are custom properties on that root, light first, then
   `@media (prefers-color-scheme: dark)`.
3. Interactive elements are the theme's own `<button>`s, calling `m.toggle` / `m.openSettings`.
   Decorative elements are `aria-hidden`.
4. It may ignore fields (Baseline ignores `pausedMs`/`pause`).

`pause` is computed by the shell: `running ? "none" : pausedMs >= longPauseMs ? "long" : "short"`.

## 4. Pill shell (`pill/PillWindow.tsx`)

Owns, in this order:
1. `useSettings()`, `useTimer()`, `useWindowPosition()` (unchanged).
2. Content protection effect (moved verbatim from today's PillWindow).
3. Model construction (section 3).
4. `useFitWindow(width)`: width = theme `withButton` or `bare`.
5. Render:
```tsx
<div className="pill-shell" data-tauri-drag-region="deep" onContextMenu={onContextMenu}>
  <span className="sr-only">{spokenStatus}</span>
  <Suspense fallback={null}><theme.Pill m={model} /></Suspense>
</div>
```
`onContextMenu`: `preventDefault()` then `openSettings()`. Works in every theme, button on or off.
Spoken status: "Today 1:12:36. Working, goal not met." / "Paused for 4 min" / "Goal met".

`useFitWindow(width)`:
- Skip in a plain browser and before settings load (avoids a resize to the default theme first).
- Read `outerPosition()`, `outerSize()`, `scaleFactor()`. New physical width = `round(width * scale)`.
- If it differs: `setPosition(x + oldW - newW, y)` then `setSize(PhysicalSize(newW, oldH))`.
  Right edge stays put. Position is saved by the existing `saveWindowState` debounce (onMoved fires).
- One effect keyed on `width`. Errors are logged, never thrown (a wrong size is cosmetic).
- Capabilities: add `core:window:allow-set-size`, `core:window:allow-set-position`.
- `tauri.conf.json` main width stays 248 (the baseline-with-button default), so first paint on a
  default install needs no resize.

## 5. Settings data

Migration `0004_pill_theme.sql` (LF, never edited after shipping):
```sql
INSERT INTO settings (key, value) VALUES ('pill_theme', 'baseline');
INSERT INTO settings (key, value) VALUES ('pill_settings_button', '1');
INSERT INTO settings (key, value) VALUES ('long_pause_min', '20');
```
`Settings` gains `pillTheme: string`, `pillSettingsButton: boolean`, `longPauseMs: number`.
`getSettings()` parses with fallbacks (missing/garbage → defaults), so a bad row can't blank the pill.
`SettingKey` gains the three keys. All windows already reload on `settings-changed`, so a style
change in settings reaches the pill with no new plumbing.

## 6. Settings window

Order (Ledger's), look (Baseline's existing CSS):
```
<header> h1 "Hormozi Timer"
<HistoryChart/>                       baseline chart, + memo line "1 of 2 days kept · goal 4h a day"
<h2 class="back-matter">Preferences</h2>
<section> PILL         StylePicker | Appearance (was "Theme") | Settings button | Show in recordings
<section> DAILY RHYTHM Daily goal | Day starts at | Week starts on | Long pause after (min)
<section> SYSTEM       Open at login
<button class="quit">
```
- Section `h2`s become small caps (CSS only).
- `StylePicker`: a radiogroup of three cards from `THEMES` (name, blurb, `<picture>` with
  `preview-dark.png` under `(prefers-color-scheme: dark)` and `preview-light.png` otherwise).
  Selecting calls `save("pill_theme", id, …)`.
- Memo line: `kept` = closed past days with `ms >= goalMs`; today excluded until it closes.
  Computed in `HistoryChart` from `days` it already has. Hidden when no day has closed.
- Long pause: number input, 5–240 min, same edit-then-save pattern as Daily goal.

## 7. Porting the themes

Each port keeps the branch's visuals and copy exactly, with these mechanical changes:
- Component signature `({ m }: { m: PillModel })`; remove all hooks, effects, `openSettings`,
  content protection, sr-only text (shell owns them).
- `ALARM_AFTER_MS` / `IDLE_MS` constants removed; use `m.pause === "long"`.
- Tokens from the branch's `styles/tokens.css` move onto `.pill[data-theme=<id>]`; `@font-face`
  rules move into the theme's `pill.css`. Global `tokens.css` is untouched (Baseline + settings).
- Settings button:
  - Baseline: existing sliders button + rule, rendered only when `m.showSettingsButton`.
  - Instrument: new square key matching its play key, sliders icon, after play.
  - Ledger: existing book button, rendered only when `m.showSettingsButton`.
- Widths: baseline 248/214, instrument 282/248, ledger 248/216 (verified by screenshot in step 9).

## 8. Harness

- Fixture URL gains `theme=<id>` and `button=0|1`; `fixture.ts` exposes `fixtureSettings` merged into
  `useSettings`' initial state.
- `shoot.mjs` loops `THEMES` ids (hard-coded list in the script, checked against registry by a test)
  × states × button on/off × light/dark; viewport width = manifest width.
- It writes `pill-<theme>-<state>-<mode>[-bare].png`, composites, history shots, and the six picker
  previews (`running-near`, with button) into `src/themes/<id>/preview-<mode>.png`.

## 9. Order of work and checks

1. Engine (`holdMs`, tests).                         check: `bun test`
2. Settings data (migration, db.ts).                 check: migration test reads all four defaults
3. Theme contract + registry + shell + fit-window.   check: `tsc`
4. Port baseline → instrument → ledger.              check: `tsc`, harness per theme
5. Settings window.                                  check: harness history shots
6. Harness update + previews committed.              check: two runs byte-identical
7. `bun tauri dev` smoke: switch styles, toggle button, right-click, restart mid-pause.

## 10. Risks

- **CSS leakage between themes.** Mitigated by rule 2 and a test that every selector in
  `themes/*/pill.css` starts with its own `.pill[data-theme=…]` (simple regex over the files).
- **Resize at wrong DPI.** Use physical units throughout; one code path.
- **Lazy chunk not loaded yet** on first paint: `Suspense fallback={null}` shows an empty transparent
  window for a frame. Acceptable.
- **Bad `pill_theme` value** (old build, hand edit): `themeById` falls back to baseline.

## 11. Changes after review (GPT-6 Astra, approve with changes)

Adopted, and built that way:

| Finding | Change |
| --- | --- |
| Anchoring on launch drifts the pill every restart (position is restored, width resets to 248) | First fit after launch sizes in place; only later changes keep the right edge fixed (`pill/useFitWindow.ts`) |
| Concurrent / stale resizes, move-then-fail clipping | Fits are queued one at a time and use the latest width; size first, then position; `PhysicalSize`/`PhysicalPosition`; position saved after the fit |
| Lazy themes can leave an invisible pill | Themes are imported eagerly; no Suspense, no chunk failure path |
| CSS port missed helpers, fonts, keyframes | Instrument's `.seg*` rules, typography and fonts moved under its root; keyframes and font families carry the theme id; Ledger's serif package is imported by its theme |
| Settings parsing accepted garbage; UPDATE-only saves | Pure `lib/settings.ts#parseSettings` validates every field; `setSetting` upserts; overlapping reloads can't overwrite newer values; a failed save reloads from the DB |
| Pause write succeeds, total refresh fails, pill stays "running" | State follows the committed write immediately; the total refresh is separate and allowed to fail |
| Harness could capture an unrendered theme | Waits for `.pill[data-theme=<id>]`; fails if a theme overflows its declared width or the theme list drifts from the registry |
| Keep `api: 1` and token rules for future user themes | `PillTheme.api`, rules documented at the top of `themes/types.ts` |

Not adopted:
- Re-fitting on monitor DPI change. Windows rescales per-monitor-aware windows itself; revisit if a mixed-DPI user reports it.
- A selector-prefix regex test. With eager imports every page loads every theme's CSS, so the harness already renders each theme with all the others present.
- A failure-injection test for `toggle`. There's no React test setup in the repo; the fix is structural (state set right after the awaited write).

## 12. Changes after review (DeepSeek V4.1 Flash, approve with changes)

Most findings matched Astra's and were already built (startup drift, Tauri position/size types,
eager themes, scoped helpers and fonts, `INSERT OR IGNORE` + upsert, harness waits on the theme).
New and adopted:

| Finding | Change |
| --- | --- |
| With no pause yet today, hold time counted from the day start, so a morning launch or fresh install opened red with hours of "idle" | `holdMs(now, lastPause, dayFrom, launchedAt)`: a pause from today counts from that pause (survives restart); otherwise from the later of day start and app launch. Tests cover restart, morning launch, fresh install, and app left open overnight |
| The spoken status was a live region updated every second | Plain visually hidden text; screen readers read it on focus, not every tick |
| Token override seam for user themes | Documented in `themes/types.ts`: a future user theme overrides with a more specific shell selector. No indirection built now |

Not adopted:
- `--theme-*` indirection on every token: the specificity route above already gives user themes a way in.
- "No closed days yet" memo text: the line is hidden until a day closes, which reads cleaner.
- A 35-minute fixture: the two paused fixtures already sit either side of the 20-minute threshold.
