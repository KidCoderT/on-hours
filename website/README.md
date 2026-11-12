# On Hours website

The landing page. Vite + React + TypeScript, animations with `motion`.

```powershell
cd desktop; bun install   # once: the site renders the app's own components
cd ../website; bun install
bun run dev               # http://localhost:5173
bun run build             # output in dist/
```

## How it fits together

- **The pills and the chart are the app's real components**, imported through the `@app` alias
  (`../desktop/src`). `src/demo/useDemoTimer.ts` feeds them a timer that runs in the browser.
  Change a pill style in the app and the site changes with it.
- **Sections** live in `src/sections`, in page order: Header, Hero, Idea, Styles, Week, Settings,
  Download, ComingSoon, Footer. All styling is in `src/site.css`.
- **Download button** reads the newest release from the GitHub API (`src/lib/release.ts`) and
  falls back to the releases page.
- **Settings screenshots** in `public/shots` come from the real settings window:
  `node scripts/shots/site.mjs` from the repo root regenerates them.
- **Drawn, not captured:** the Windows SmartScreen dialogs and the tray menu in the Download
  section are CSS drawings. The map and leaderboard under "Coming soon" are previews with sample data.

## Deploying

Any static host works. Build command: `cd desktop && bun install && cd ../website && bun install && bun run build`.
Output folder: `website/dist`.
