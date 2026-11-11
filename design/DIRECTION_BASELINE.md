# Direction: Baseline, as a Mac app

`DIRECTION.md` said the old Baseline "looks like a well-made macOS preferences pane" and called
that a non-decision. This makes it the decision. Baseline is a Mac utility: the pill is a small
system panel.

Scope: the Baseline pill only (`themes/baseline/Pill.tsx`, `pill.css`). A Mac-style settings
window (System Settings boxes, Screen Time chart) was tried and rejected: the settings window
keeps the app's original look. Instrument and Ledger are untouched.

## Thesis

A tool Apple could have shipped. Trust comes from familiarity: nothing here is invented, so
nothing here needs learning. The one thing it says loudly is the state of the clock, and it says
it with the most recognised three colours on a Mac: the window's traffic lights.

## The first 3 seconds

"That's a Mac thing." Calm, finished, a little expensive. You read the light before the number:
yellow, it's running. Red, it's stopped. Red and moving, you've been gone too long.

## Rules

### Type

- **Face:** the system face. `-apple-system` (SF Pro) on a Mac; bundled **Inter Variable**
  everywhere else, because SF cannot be shipped and Inter is its closest open relative.
  No second face, no mono, no serif.
- **Numerals:** tabular, always.
- **Scale** (macOS text styles, px / line / weight):

| Use | Size | Line | Weight |
|---|---|---|---|
| Pill digits | 23 | 23 | 590 |
| Week total | 28 | 34 | 600 |
| Window title (`h1`) | 22 | 28 | 700 |
| "Preferences" | 17 | 22 | 700 |
| Group label, History | 13 | 16 | 600 |
| Body, controls | 13 | 16 | 400 |
| Hints, axis, footnote | 11 | 14 | 400 |

- Tracking: −0.02em at 23px and up, −0.015em at 22px, 0 below. No uppercase, no small caps.

### Palette

Pill (its own variables, so it never depends on the settings window):

| Role | Light | Dark |
|---|---|---|
| Surface | `#F6F6F6` | `#2A2A2C` |
| Border | black 16% | black 65% + 1px inner white 12% |
| Primary label | black 85% | white 85% |
| Secondary label (settings glyph) | black 45% | white 45% |
| Control fill / hover / pressed | black 6 / 11 / 17% | white 9 / 15 / 22% |

Traffic lights, same in both modes (fill / rim):

| Light | Fill | Rim |
|---|---|---|
| Red | `#FF5F57` | `#E0443E` |
| Yellow | `#FEBC2E` | `#DEA123` |
| Green | `#28C840` | `#1AAB29` |


### Spacing, radii, density

- **Pill:** 48 tall, full capsule. Padding 16 left, 9 right. Light 12, gap 11 to the digits.
- **Controls:** 30 round; only play/pause sits on a fill, the settings glyph is bare.
- **Density:** sparse. A light, a number, one filled control.
- **Edges, not shadows.** A 1px border and a 1px inner highlight. No drop shadow, no gradient, no blur.

### Motion

- Controls: 150ms ease-out.
- The status light is still in every state but one. On a long pause it bounces twice (1.1s, once)
  and then breathes on a 5s cycle.
- Nothing else moves. The old running pulse is gone: a Mac's light is steady while it is awake.
- `prefers-reduced-motion` removes the bounce, the breathing and every transition.

## The three decisions

**Digit face.** The system face, 23px at weight 590, tabular. A Mac shows time in the same face
it shows everything else in (menu bar clock, Clock app, Screen Time), and makes it matter with
size and weight, never with a special font. The number went from label weight (21/500) to the
heaviest thing in the pill. Inter's colon lifts to digit height between numerals, the same thing
SF does in the menu bar clock.

**Paused treatment.** Three steps, all borrowed from how a Mac shows attention:

1. *Paused, short.* The light is a steady traffic-light red. The digits keep full strength: the
   number never dims. (A grey "inactive window" look was tried and rejected: it read as broken.)
2. *Paused past "Long pause after"* (20 min by default, the user's own setting). The red light
   bounces twice, the way a Dock icon asks for attention.
3. *Still paused.* The red light breathes every 5s, like the power light on a sleeping Mac, until
   work resumes.

Once today's goal is met the light is green and stays green, paused or not. Baseline still shows
no pause duration; the light alone carries it.

**Settings access.** The menu bar, which on Windows is the tray icon: left-click opens the
window, the menu has "Settings". Right-click on the pill does the same. That is where every Mac
utility keeps it. The glyph on the pill stays as the existing optional switch (on by default);
it is drawn as a bare secondary glyph so the play button is the only filled control.

## Where it lives in the code

- `desktop/src/themes/baseline/Pill.tsx`, `pill.css`: the pill. Width is 232 (200 without the
  settings glyph), set in `themes/registry.ts`.
- `@fontsource-variable/inter`: the one new dependency.
