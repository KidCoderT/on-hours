# Aesthetic direction

Written before touching UI. Based on reading `desktop/src`, `design/*.html`, `design/review/*.png`, and the README.

## 1. What the app is

**What it does.** A frameless, always-on-top 248×48 pill that shows today's accumulated work time, a play/pause button, and a red/yellow/green dot against a daily minimum. Sessions go to SQLite. A separate settings window holds goal, day start, week start, theme, screen-recording privacy, open-at-login, and a weekly history (bars or timeline).

**The one job.** Press play when real work starts, press pause when it stops. Everything else exists so that the number at the end of the day is believable.

**Who, how often, in what state.**
- One person at a time, on their own machine. The README frames it for Hormozi-style founders, but the Later list (leaderboard, "how many live studying") points at students and self-studiers too. Same psychology either way: a person policing themselves.
- The pill is touched dozens of times a day in sub-second interactions: a glance in peripheral vision, one click. The user is either in flow or trying to get into it. They are not browsing; anything that asks for attention is a cost.
- The settings/history window is opened once a week, maybe nightly. That is the reflective mode: "did I actually do it?" Mild dread, some pride. Not rushed.
- Emotional core: honesty with a sting. A red dot at 4pm is supposed to hurt a little.

## 2. What it feels like now, honestly

It looks like a well-made macOS preferences pane that happens to run on Windows. Inter, `#fcfcfc`/`#202020`, 1px hairlines, 8px radii, iOS switch, segmented control, muted red/yellow/green. Tidy, competent, anonymous. Nothing is wrong and nothing is memorable.

Where the look fights the purpose:

1. **The number is set like a label.** 21px, weight 500, in a 48px pill. The entire product is that number and it has the visual weight of a caption.
2. **The status signal is 6px and desaturated.** The red was tuned so it would not sting. The whole premise is that it should.
3. **Three affordances in 248px, two of them chrome.** Play, a divider rule, and a sliders icon that opens a window used weekly. The pill carries permanent furniture for a rare action.
4. **The ledger is buried.** History is the only screen with meaning and it sits below Theme and Week-starts-on, under a header that says "Settings / Hormozi Timer". Config outranks the record.
5. **Neutral-first, state-second.** Bars are grey until the goal is met, then green. Reasonable, but the pill, chart, and detail row each express state slightly differently (dot, bar colour, delta arrow). No single visual language for "where you stand."
6. **Name and look disagree.** "Hormozi Timer" promises brash. The UI is a polite Fluent panel. Either could be right; currently it is a non-decision.
7. Things that are already good and worth keeping: the 3s pulse, the theme crossfade, tabular numerals, the goal gridline, the reduced-motion handling, the timeline view.

## 3. Three directions

Deliberately not included: "hustle brutalism" (black, Impact caps, red, grind quotes). It is the obvious reading of the name and it is what every productivity YouTuber's app already looks like.

---

### A. The Instrument

**Thesis.** A hardware readout, because users are logging, not browsing.

**First 3 seconds.** "That's a stopwatch, not an app." Mechanical, truthful, slightly cold. You trust it the way you trust a kitchen scale.

**Decisions.**
- Type: a monospaced or display-grade tabular face for the digits (Berkeley Mono, JetBrains Mono, or Inter at 600 with tabular numerals and wide tracking). Digits dominate; labels are tiny caps.
- Colour: near-black readout, one accent only. Status lives in the digits, not a dot: dim when paused, amber while running, green when the goal is met. Red is reserved for "paused and under goal after a threshold", and it is a real red.
- Density: pill is sparse, settings is dense. History becomes a table of rows (date, sessions, total, delta) with the chart as a secondary view.
- Motion: none beyond the 1s tick. No eased bar growth, no crossfades. Instruments snap.
- Chrome: no border, no divider, no settings icon. The pill is just digits and a play glyph; settings is reached via right-click, tray, or a hidden hover-reveal.
- Light/dark: dark readout by default regardless of system theme, optional "paper" light variant. Sharp: 2 to 4px radii.

**References.**
- Braun ET66 / Rams clocks: one accent colour, everything else is black and typographic restraint.
- Casio F-91W: the digits are the product; the case is incidental.
- Teenage Engineering OP-1 / TX-6: hardware with personality through labels and a single bright accent, not through decoration.

**Rejects.** Cards, rounded friendliness, system-native widgets, colour as decoration, any animation that is not the clock.

---

### B. The Ledger

**Thesis.** A bookkeeper's page, because the number doesn't lie.

**First 3 seconds.** "Someone keeps careful records here." Sober, warm, earned. A ledger is honest without being hostile.

**Decisions.**
- Type: a serif for headings and the big weekly total (Newsreader, Source Serif, Tiempos); Inter or a sans for rows. Tabular numerals everywhere. Small caps for column heads.
- Colour: warm paper (`#F3F0E9` family; `design/deepseek.html` already explored this) with ink black. Dark mode is charcoal slate, not pure dark. One ink red for shortfall, one ink green for met. No yellow; "running" is a filled vs hollow mark.
- Density: high in the history window. Seven rows per week, columns for sessions, first start, last stop, total, versus goal. Double-rule under totals. Charts become sparklines inside rows rather than a hero chart.
- Motion: almost none. Things appear; they do not slide or grow.
- Chrome: rules, not boxes. No cards, no toggles as decoration. Inputs are underlined fields.
- Light/dark: paper-light first. Soft edges only where paper would curve; otherwise square.
- The settings window is renamed to the ledger; preferences move to a footer or a second tab.

**References.**
- Accounting ledger paper and Field Notes: ruled rows, right-aligned numbers, totals under a double rule.
- Tufte: maximise data-ink, sparklines, small multiples, no chart junk.
- iA Writer: type-first UI where almost everything is text and one accent.

**Rejects.** Hero charts, dots, pills, toggles, system-grey neutrality, gradients, anything that reads as "dashboard".

---

### C. The Desktop Pet

**Thesis.** A small creature that lives on your work, because showing up daily is a habit, not a metric.

This is the one you probably would not pick. The README already calls the pill a desktop pet; this takes it literally. It also fits the Later items best: "how many live studying" and a leaderboard are study-with-me culture, which is lo-fi, cute, and communal.

**First 3 seconds.** "Oh, it's alive." Warmth, a little guilt, affection. The state of the creature is the status signal.

**Decisions.**
- Type: rounded sans or a pixel face for the time (Pixelify, Departure Mono, or Nunito). The number is still legible and tabular, but secondary to the creature.
- Colour: an owned palette, not system-following. Saturated but limited: one warm, one cool, one alarm. The creature's colour and posture carry red/yellow/green: asleep and faded when paused, awake and bright when running, glowing or celebrating when the goal is met.
- Density: very low. The pill is the creature plus digits. No border, no window shape; it floats on the desktop like a Shimeji.
- Motion: the only direction with real motion. Idle breathing, perk-up on play, slow droop after long idle, a one-off celebration on goal. All under 400ms except the idle loop, and all respect reduced motion.
- Chrome: none visible. Settings open from clicking the creature or a tray menu.
- Light/dark: its own palette; the creature carries the identity on any wallpaper. Soft everywhere.
- Settings becomes a "care log": streak calendar (contribution heat-map), longest streak, this week vs last. Preferences are a small tab.

**References.**
- Tamagotchi: state communicated through the creature, not through numbers. Neglect is visible.
- Duolingo streaks and Forest: guilt and pride as motivators, streak as the primary stat, celebration moments that are earned.
- Shimeji / Bongo Cat desktop mascots: a borderless sprite that lives on top of other windows and reacts to the user.

**Rejects.** Looking professional, charts as the primary view, neutral greys, the grind connotation of the name (the product would probably want a different name under this direction).

## 4. Pick

**A, the Instrument.** Reasons:

- It serves the one job most directly. A glance at big digits whose colour is the status beats a 6px dot next to a label-sized number. Zero chrome in the pill removes the two affordances that are not the job.
- It matches the thesis of the product. "The number doesn't lie" is an instrument's promise. Instruments do not editorialise, and neither should this.
- It is robust on Windows. A dark readout holds up over any wallpaper and in ClearType. The Ledger's serif at 21px in a 48px pill on Windows will look worse than it does in a mockup, and warm paper floating over an arbitrary desktop looks dirty rather than warm.
- It is achievable by one developer with CSS and a font, no illustration pipeline. The Pet is the most memorable and the most marketable, but it needs sprite work, motion design, and arguably a rename, and cuteness softens the accountability that is the whole point.

Steal from the others: take the Ledger's history table and double-rule totals for the settings window, since paper density is right for the weekly reckoning even if paper colour is wrong for the pill. Keep the Pet's idea of a single state language (one signal, carried consistently) but express it through digit colour rather than a creature.

Still to decide before building: the digit face (bundled Inter tabular at 600 vs. adding one mono font), the exact threshold at which paused turns from dim to red, and how settings are reached once the sliders icon leaves the pill (right-click on the pill is the cheapest; the planned tray icon is the proper home).
