# Plan: On Hours landing page

Status: built in `website/` (see `website/README.md`). Not deployed yet.

One page that explains the app, shows the pill working, and gets a visitor to a successful
install on Windows. Leaderboard and map appear as "coming soon".

## 1. Stack

| Choice | Why |
|---|---|
| Vite + React (with React Compiler) + TypeScript, in `website/` | Same stack as the app, so the site can import the app's own pill components |
| Plain CSS (one file per section) + CSS variables | Same approach as the app. No Tailwind, no component library: those are what make a site look generated |
| `motion` (Framer Motion) | The one animation library. Scroll reveals, the hero sequence, layout transitions |
| `@fontsource-variable/inter`, `source-serif-4`, the app's bundled DSEG7 | Already used by the pill themes |
| No router, no state library, no CMS | It is one page |
| Hosting: Cloudflare (static assets on a Worker) | Same place the leaderboard API will live later |

`website/` is its own package (`on-hours-website`). It imports from `../desktop/src/themes`
through a Vite alias, so the pills on the site are the real ones, not screenshots. The alias needs
`resolve.dedupe: ["react", "react-dom"]`: otherwise the app's files load the app's own copy of React
from `desktop/node_modules`, and two Reacts on one page break hooks.

## 2. The key idea: the pill on the page is the real pill

`themes/*/Pill.tsx` only draws a `PillModel`; it has no Tauri or database code. The site builds
a fake `PillModel` (a timer that runs in the browser) and renders the app's own components.

What that buys:
- The hero pill ticks, pauses, and turns green for real. Visitors can click play/pause.
- Switching Baseline / Instrument / Ledger on the page shows exactly what the app shows.
- When a theme changes in the app, the site updates with it. No screenshots to redo.

One small file does it: `website/src/demo/useDemoTimer.ts` (elapsed, running, pause level, goal).

## 3. Visual direction

Follow the app's Baseline: quiet, Mac-like, mostly neutral, colour only for state.

- **Background:** `#F6F6F6` (the pill's own surface). Dark mode `#1C1C1E`. Follows the system.
- **Text:** `#1F1F1F` / `#E6E6E6`. Secondary `#6A6A6A` / `#9D9D9F`.
- **Colour:** only the three traffic-light colours (`#FF5F57`, `#FEBC2E`, `#28C840`), and only
  where they mean paused / working / done. No gradients, no purple, no glow blobs.
- **Type:** Inter Variable. Headline 56–72px desktop, 36–40px mobile, weight 650, tracking −0.03em.
  Body 17px / 28px. Small 14px. Numbers always tabular.
- **Layout:** one 1080px column, 24px side padding on mobile. Sections 120px apart (72px mobile).
- **Shapes:** capsules for the pill and buttons, 12px radius for panels, 1px hairlines. No cards
  with drop shadows.
- **Tone of copy:** short, plain, no hype. "The number doesn't lie."

What keeps it from looking generated: one typeface, almost no colour, real product UI instead of
illustrations, no emoji, no icon grid of six features, no "trusted by" strip, no testimonials.

## 4. Page sections, top to bottom

### 4.1 Header
Logo mark + "On Hours" left. Right: "How it works", "Styles", "Download", GitHub icon.
Sticky, transparent until scrolled, then the page colour with a hairline. On mobile: logo and a
"Download" button only.

### 4.2 Hero
- Headline: **"Count the hours you actually work."**
- Sub: "A tiny timer that sits on your screen. On when you work, off when you stop. At the end
  of the day, the number doesn't lie."
- Primary button: "Download for Windows" (to the latest release). Under it: "Free · Windows 10
  and 11 · v0.1.0" (version read from the GitHub API, with a fallback).
- Secondary: "View on GitHub".
- **The live pill**, large (scaled 1.6×), sitting on a soft desktop mock (a blurred, generic
  window outline in greys, drawn in CSS). It runs on load; the visitor can click pause and play.

Hero animation (once, about 4s, skippable by interacting):
1. Pill fades and settles in, paused, red light.
2. A cursor dot moves to play and clicks: light turns yellow, digits start.
3. Time fast-forwards (digits roll) to the goal: light turns green.
4. It returns to real time and stays interactive.

### 4.3 The idea (three short beats)
Three rows, each a sentence and a small live pill in the matching state:
1. "Press play when real work starts." (yellow, ticking)
2. "Press pause when it stops." (red, with the long-pause bounce shown on hover)
3. "Hit your daily minimum." (green)

On scroll each row reveals and its pill animates into its state. On mobile they stack.

Under the three rows, one quiet line: "The rule comes from Alex Hormozi: when you work, turn the
timer on. When you stop, turn it off."

### 4.4 Styles
"Three looks. Same honest number."
A segmented switch (the app's own control look): Baseline · Instrument · Ledger. The pill below
swaps with a short crossfade, and the page's sample panel takes that style's colours and font
(Instrument: mono on LCD green-grey, Ledger: serif on paper), the same trick the settings window uses.
One line per style, taken from the theme blurbs. Light/dark toggle beside it.

### 4.5 The week (history)
"See how the week really went."
The real `HistoryChart` component with fixture data (the screenshot harness already has it:
`lib/fixture.ts`). Bars grow in on scroll; hovering a day shows its total. Totals / Timeline
switch works. On mobile the chart is full width and the timeline view is hidden.

### 4.6 Settings, explained
Two columns on desktop: a real screenshot of the settings window on the left (sticky), a short
list on the right. On mobile: screenshot first, list under it.

| Setting | One line |
|---|---|
| Style | How the pill looks |
| Appearance | Light, dark, or follow Windows |
| Daily goal | Your minimum hours. The pill turns green when you hit it |
| Day starts at | When a new day begins, for night owls |
| Long pause after | How long a break can run before the pill warns you |
| Show in screen recordings | Hide the pill from recordings and screen shares |
| Open at login | Start with Windows |

Plus one line: "Right-click the pill, or use the tray icon, to open settings."

### 4.7 Download and install
The section the "Download" links scroll to. A numbered list with a picture per step:

1. **Download** the setup file. (Button: `On Hours_x.y.z_x64-setup.exe` from the latest release.)
2. **Run it.** Windows shows "Windows protected your PC" because the app is new and not yet
   code-signed. Click **More info**, then **Run anyway**. (Two annotated screenshots.)
3. **Find the pill.** It appears on your screen; the tray icon is by the clock (it may be under
   the ^ arrow).
4. **Updates install themselves** while the timer is paused.

A short honest note under step 2: why the warning appears, that the code is open source, and a
link to the repo. Also: "Mac and Linux: not yet."

On a phone the button changes to "Send me the link" (a `mailto:` to yourself / copy-link),
because nobody can install a Windows app from a phone.

### 4.8 Coming soon
Two quiet panels side by side (stacked on mobile), each with a "Coming soon" tag:
- **Live map:** a dotted world map drawn in SVG with a few softly pulsing dots (fake, labelled as
  a preview). "See where people are working right now."
- **Leaderboard:** five blurred placeholder rows. "Today's longest hours. Opt-in and anonymous."

No sign-up form. One line under both panels: "Already installed? These arrive by themselves:
On Hours updates automatically."

### 4.9 Free
One line, not a pricing table: "On Hours is free and open source." A muted "Support the project"
link can be added later if you decide on donations; the layout leaves room for it.

### 4.10 Footer
GitHub · Releases · Report a problem (issues) ·
version · © year.

## 5. Motion rules

- One library (`motion`), one easing family (ease-out, 200–500ms). Nothing bounces except the
  pill's own long-pause light.
- Scroll reveals: 12px rise + fade, once, staggered 60ms. No parallax, no scroll-jacking.
- The pill's own animations come from its CSS, unchanged.
- `prefers-reduced-motion`: no hero sequence (pill starts in its running state), no reveals.
- Animations run only while on screen (IntersectionObserver), so the page stays cheap.

## 6. Responsive

| Width | Layout |
|---|---|
| ≥ 1024 | Full layout, two-column settings and coming-soon |
| 640–1023 | Single column, hero pill at 1.3× |
| < 640 | Single column, 24px padding, hero pill at 1× (it is 232px wide, so it fits a 320px phone), header shrinks to logo + Download |

Touch: play/pause on the demo pill is a 44px target on mobile. No hover-only information.

## 7. Images and assets needed

Generated or reused (no work from you):
- **Pills:** none. They are live components.
- **History chart:** none. Live component with fixture data.
- **Logo and favicon:** from `desktop/src-tauri/icons/icon.svg`.
- **Social preview image** (1200×630): rendered by the screenshot harness (pill on the page
  background with the headline).
- **World map outline** for "coming soon": `world-atlas` data, drawn as SVG dots.

Needed from the real app (I can capture most with the harness; two need your machine):
1. `settings-light.png` and `settings-dark.png`: the settings window, Baseline style (harness).
2. `smartscreen-1.png`: the "Windows protected your PC" dialog. **You capture this** when
   running the installer on a clean download.
3. `smartscreen-2.png`: the same dialog after "More info", showing "Run anyway". **You capture.**
4. `tray.png`: the tray icon with its menu open. **You capture.**
5. Optional: a 10–15s screen recording of the pill on a real desktop, for the hero on slow
   devices or as the social video.

All screenshots saved at 2× as WebP, with width/height set so nothing jumps while loading.

## 8. Files

```
website/
  index.html
  vite.config.ts          alias @app -> ../desktop/src
  src/
    main.tsx  App.tsx  site.css (tokens, type, layout)
    demo/useDemoTimer.ts   fake PillModel for the live pills
    sections/Header.tsx Hero.tsx Idea.tsx Styles.tsx Week.tsx Settings.tsx
             Download.tsx ComingSoon.tsx Free.tsx Footer.tsx   (+ one .css each)
    lib/release.ts         latest version + installer URL from the GitHub API, with fallback
  public/                  screenshots, favicon, social image
```

One change in the app to make sharing clean: `HistoryChart` and the pills already avoid Tauri
calls in fixture mode; the site uses that same path. If anything imports Tauri at module level,
it gets a small guard rather than a copy.

## 9. Quality bar before it ships

- Lighthouse: performance and accessibility ≥ 95 on mobile.
- JS under 150 KB gzipped (React + motion + the pills).
- Keyboard: every control reachable, visible focus ring, demo pill buttons labelled.
- Title, description, Open Graph tags, favicon, `robots.txt`.
- Checked at 320, 390, 768, 1280 and 1920 wide, light and dark.

## 10. Build order

1. Scaffold `web/`, tokens, header, footer, and the live pill rendering from the app's code.
2. Hero with the intro sequence. Download button wired to the latest release.
3. Idea, Styles, Week sections.
4. Settings and Download/install sections (placeholders until the screenshots arrive).
5. Coming soon, Free, meta tags, social image.
6. Responsive pass, reduced motion, Lighthouse, deploy to Cloudflare.

## 11. Decisions

- **Domain:** free Cloudflare address for now. Name the Cloudflare Worker `on-hours`, so the site is
  `on-hours.<your-subdomain>.workers.dev`, and the leaderboard API joins the same Worker later.
  A custom domain can be added at any time without changing code.
- **Headline:** "Count the hours you actually work."
- **Hormozi credit:** in the idea section, not the footer.
- **Coming soon:** no sign-up. The app updates itself, so installed users get the features when
  they ship.
- **Names:** folder `website/`, package `on-hours-website`, Worker `on-hours`. The app stays
  `on-hours` in `desktop/`.
