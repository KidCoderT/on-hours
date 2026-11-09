# Plan: pill themes + reorganised settings

Status: **plan, not built.** Mockup: `design/plan/mockup.html`.

**The three pill themes are 1. Baseline, 2. Instrument, 3. Ledger**, in the order of the comparison page.
Panel is not part of this plan.

---

## 1. What we are building

- **Pill themes.** The user picks one of three pill looks: Baseline, Instrument, Ledger. Each keeps its
  own layout, fonts, colours, light/dark, and status language. The timer underneath is identical.
- **One settings window** with the Ledger's organisation (the week's record first, preferences after)
  and Baseline's look and totals chart, instead of the Ledger's table and paper styling.
- **Right-click on the pill opens settings, in every theme.** A settings button on the pill is optional,
  per user, on or off.
- **Hold time is a core feature.** Instrument and Ledger show it. Baseline doesn't, and stays that way.
- **Room for user-made themes later**, without building that now.

## 2. Pill: the modular system

### 2.1 Split: core vs theme

Today each branch's `PillWindow.tsx` mixes timer behaviour, window plumbing, and visuals.
Split into two layers:

| Core owns (one copy, all themes) | Theme owns (one per theme) |
| --- | --- |
| Timer engine: sessions, heartbeat, day boundary | Layout and DOM of the pill |
| Hold time and pause level (2.4) | Mapping core state to its own words: dot colours, RUN/HOLD/IDLE, ink/pencil |
| Right-click opens settings | How its settings button looks |
| Screen-recording protection | Fonts, colours (light and dark), radii |
| Drag region, window position | Number formatting ("1:12:36", "0:19", "(1:20)") |
| Resize the window to the theme's size | Its width, with and without the button |
| Spoken status for screen readers | Motion: Baseline's pulse, Instrument's blink |
| Play/pause action and disabled state | |

### 2.2 The contract between them

Core computes one object per tick and hands it to the active theme. This object *is* the theme API.

```ts
// themes/types.ts
export type PillModel = {
  elapsedMs: number;      // today's total
  goalMs: number;
  progress: number;       // 0..1, clamped
  remainingMs: number;    // to goal, 0 once met
  overMs: number;         // past goal, 0 before
  running: boolean;
  done: boolean;          // goal met today
  pausedMs: number;       // hold time, 0 while running (2.4)
  pause: "none" | "short" | "long";
  ready: boolean;         // play enabled
  showSettingsButton: boolean;
  toggle(): void;
  openSettings(): void;
};

export type PillTheme = {
  id: "baseline" | "instrument" | "ledger";
  name: string;
  blurb: string;                                // one line for the picker
  api: 1;                                       // contract version (2.6)
  size: { width: number; widthWithButton: number; height: 48 };
  Pill: React.ComponentType<{ m: PillModel }>;  // lazy-loaded with its CSS and fonts
};
```

Rules for a theme component:
- **No side effects.** No Tauri calls, no DB, no timers. It renders `m`. Animation is CSS only.
- **All visual values are CSS custom properties** declared on its root, in light and dark.
  This is what makes user themes possible later (2.6) without touching code.
- **Root element is `.pill[data-theme="<id>"]`**, and every selector in its CSS is under that.
- A theme may ignore fields. Baseline ignores `pausedMs` and `pause`.

### 2.3 Folder layout

```
desktop/src/
  pill/
    PillWindow.tsx       core shell: model, right-click, resize, a11y, recording protection
    usePillModel.ts      builds PillModel from useTimer + settings
    useTimer.ts          the engine (moved, merged; see 2.4)
  themes/
    types.ts             PillModel, PillTheme
    registry.ts          [baseline, instrument, ledger], lazy imports, default id
    baseline/    index.ts  Pill.tsx  pill.css            (today's pill on main, moved)
    instrument/  index.ts  Pill.tsx  pill.css  Seg.tsx  fonts/ (DSEG7, JetBrains Mono)
    ledger/      index.ts  Pill.tsx  pill.css  fonts/ (Source Serif 4)
```

`registry.ts` uses `import()` per theme, so only the active theme's CSS and fonts load in the
pill window. The settings window's picker uses screenshots, not live components (2.7).

### 2.4 Hold time: merge first, then freeze

Instrument and Ledger each changed how "paused for how long" is counted, in different ways:

| Branch | Paused counts from |
| --- | --- |
| Base (Baseline) | the last pause, read from the database on launch |
| Instrument | the last pause, but not before today's day start |
| Ledger | the latest of: last pause, today's day start, app launch (`idleMs`, tested) |

**Core rule: hold time counts from the later of the last pause and today's day start.**
This is Ledger's tested `idleMs` without its app-launch term, which is the same as Instrument's rule.

- Yesterday evening never counts against this morning, because of the day-start term.
- **Hold time survives an app restart within the same day.** Pause at 13:30, close the app at 14:00,
  reopen at 14:10: the pill says paused for 40 minutes, not 0. This is "save it".
- No new storage. Hold time is the gap between the last closed session and now. Sessions are already
  in SQLite, and `lastSessionEnd()` reads the last one on launch.

**One pause threshold, in core, as a setting:**

| Level | Default | Baseline | Instrument | Ledger |
| --- | --- | --- | --- | --- |
| `short` | under 20 min | red dot, no hold time | HOLD, dim, shows hold time | pencil, no note |
| `long` | 20 min or more | red dot, no hold time | IDLE, red, colons blink | red ink, "IDLE 0:48" note |

Both Instrument and Ledger already use 20 minutes. It becomes the "Long pause after" setting.
Baseline keeps its current behaviour exactly: the dot is red whenever paused under goal.

### 2.5 Settings access

- **Right-click anywhere on the pill opens the settings window**, in every theme. Core handles it.
- **"Settings button on pill"**: a per-user switch, **default on.** Reason: there is no tray icon yet.
  With the button off by default, a new user who doesn't guess right-click cannot reach settings at all.
- Each theme draws its own button, and declares its width both ways:

| Theme | Without button (px) | With button (px) | Button look |
| --- | --- | --- | --- |
| Baseline | ~224, estimate | 248 (today) | sliders icon after a thin rule (exists today) |
| Instrument | 248 (today) | ~284, estimate | square key matching play, sliders glyph |
| Ledger | ~214, estimate | 248 (today) | book glyph in icon grey (exists today) |

Estimates are settled in build step 3 and written into each theme's manifest.

- Changing theme or the button setting resizes the pill window. **The pill keeps its right edge
  anchored**, so it grows leftward and never slides under a screen edge it was parked against.
- A tray icon is a separate, later addition. When it exists, the button default can flip to off.

### 2.6 User-made themes later (design for it now, build nothing)

What we commit to now, so this stays possible:
1. Every themeable value is a CSS custom property on the theme root (2.2).
2. `PillTheme.api` is versioned. A breaking change to `PillModel` bumps it.
3. Theme ids are stable strings. They are stored in settings, so renaming one is a migration.

What a user theme would be, when we build it: **data only, never code.**

```jsonc
// %APPDATA%/com.tejas.hormozi-timer/themes/dusk.json
{
  "id": "dusk",
  "name": "Dusk Instrument",
  "extends": "instrument",          // layout and behaviour come from a built-in
  "api": 1,
  "tokens": {
    "light": { "--surface": "#e9e4d8", "--lit": "#b4561f" },
    "dark":  { "--surface": "#141018", "--lit": "#ff8a3d" }
  }
}
```

- `extends` means a user theme inherits layout fixes when the app updates its built-in.
- Only known token names, only CSS colour/length values. No raw CSS, no JavaScript, no remote URLs.
- Reading the folder needs either `tauri-plugin-fs` or one small Rust command. Defer the choice.
- Unknown `api` version: skip that theme, fall back to its `extends` built-in, and say so in settings.

### 2.7 Keeping themes honest as they change

- **The screenshot harness loops over the registry**: every theme × every state × with/without button
  × light/dark × three wallpapers. A new theme gets screenshots by being registered, nothing more.
- Add a 35-minute paused fixture, so the moment a pause turns "long" is captured.
- The settings picker shows harness screenshots of each theme, so previews never drift from the real
  thing. The thumbnails are committed as assets and regenerated by the harness command, so a normal
  build never needs Playwright or Chromium.

## 3. Settings window

### 3.1 Look

**Baseline's look, whatever pill theme is active:** system font, neutral greys, hairline rows,
segmented controls, light/dark from the appearance setting. The active theme lends one thing only:
its accent colour for the chart's "goal met" bars. Theming the whole window per theme triples the
design and test surface. Revisit later.

### 3.2 Structure (Ledger's organisation, Baseline's look and chart)

```
Hormozi Timer                                      ‹ This week ›
WEEK
  11h 25m                                          [ Totals | Timeline ]
  ▲ 13% vs last week
  ┌ bar chart, goal line, per-day bars (Baseline) ┐
  Mon … Sun
  Today    3h 35m    ▼ 1h 35m vs Tue          ← day detail row, follows hover
  1 of 2 days kept · goal 4h a day            ← Ledger's memo line, kept
═════════════════════════════════════════════════════════════════
Preferences

PILL
  Style            [Baseline] [Instrument] [Ledger]   ← picker with screenshots
  Appearance       System | Light | Dark              ← renamed from "Theme"
  Settings button  (on)  "Right-click the pill always opens settings."
  Show in screen recordings   (on)

DAILY RHYTHM
  Daily goal        4 h
  Day starts at     00:00
  Week starts on    Monday
  Long pause after  20 min                            ← new

SYSTEM
  Open at login     (off)

Quit Hormozi Timer
```

### 3.3 What changes, compared to each source

| Item | From | Action |
| --- | --- | --- |
| Week record first, preferences after under a ruled "Preferences" heading | Ledger | **keep** |
| Small-caps section headings (PILL, DAILY RHYTHM, SYSTEM) | Ledger | **keep** |
| Memo line: "1 of 2 days kept · goal 4h a day" | Ledger | **keep**, under the chart |
| Summary table (Day / Entries / In–Out / Hours / vs Goal) | Ledger | **remove** |
| Journal strips | Ledger | **remove** |
| Serif type, paper colours, "Ledger" title | Ledger | **remove**; title is "Hormozi Timer" |
| Rows, inputs, switches, segmented controls | Baseline | **keep** |
| Bar chart with goal line, Totals/Timeline switch | Baseline | **keep**, as the main chart |
| Day detail row (hover a day, see total and delta) | Baseline | **keep** |
| Big week total + "vs last week" | Baseline | **keep** |
| "Settings / Hormozi Timer" header, history at the bottom | Baseline | **replace** with Ledger's order |
| Instrument's per-day log table and seven-segment week total | Instrument | **remove** |
| Pill style picker | new | **add** |
| Settings button switch | new | **add** |
| Long pause threshold | new | **add** |
| "Theme" (System/Light/Dark) | Baseline | **rename** to "Appearance", so "style" means the pill |

The Timeline view stays as the second chart, as in Baseline today.

### 3.4 Flows

- **Open settings:** right-click the pill, or the pill's settings button if shown. The window shows,
  scrolled to the top, with this week's chart.
- **Change pill style:** click a card. The pill swaps immediately through the existing
  `settings-changed` event. The window resizes if the width differs. No confirm dialog.
- **Toggle settings button:** the pill gains or loses the button and resizes, right edge fixed.
- **First run:** default style, button on, so the way into settings is visible.

### 3.5 New settings keys

Stored in the existing `settings` table through one new migration (`0004`):

| Key | Values | Default |
| --- | --- | --- |
| `pill_theme` | `baseline` / `instrument` / `ledger` | see question 2 below |
| `pill_settings_button` | `0` / `1` | `1` |
| `long_pause_min` | integer minutes | `20` |

Migration files must stay byte-identical once shipped (the CRLF crash). `.gitattributes` now enforces LF.

## 4. Build order (when you say go)

1. **Base branch: merge the engine.** One `useTimer` with the hold-time rule from 2.4, `pause` levels,
   one duration formatter (Instrument's `fmtDur` and Ledger's `fmtLedger` are identical).
   Tests for hold time, including a restart mid-pause, and pause levels.
2. **Core shell + theme contract.** `PillWindow` becomes the shell; `themes/types.ts`, `registry.ts`,
   window resize with right-edge anchor, right-click to settings, migration `0004`.
3. **Port the three themes.** Baseline from main, Instrument and Ledger from their branches, each into
   `themes/<id>/`, with every token and font scoped to the theme root. Undo the branches' edits to the
   global `tokens.css` and `main.tsx`. Add a settings button to Instrument; make the button optional
   in Baseline and Ledger.
4. **Settings window reorganisation** (section 3).
5. **Harness:** loop the registry, add the 35-minute fixture, feed the picker's screenshots.
6. Delete the design branches once their themes live on the base.

Risks:
- **Global CSS leaks.** Instrument and Ledger both rewrote global tokens. Step 3 must scope everything,
  or switching themes leaves stray styles. The harness catches it if it renders every theme in one session.
- **Fonts.** Instrument needs DSEG7 and JetBrains Mono, Ledger needs Source Serif 4. Lazy loading
  keeps the pill light, but the first switch to a theme shows its fallback font for a frame.
- **Window resize jitter** when switching themes. Resize before swapping the component.

## 5. Open questions

1. **Should hold time survive an app restart?** Plan default: yes, within the same day (2.4).
   The alternative is that every launch starts the pause count at zero.
2. **Default pill style for new installs.** Recommendation: **Baseline.** It is the quietest of the three,
   and it is what existing installs already look like, so nobody's pill changes on update.
