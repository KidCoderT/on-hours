// Screenshot harness. From the repo root:  bun run --cwd desktop shots
//
// Starts Vite, freezes the browser clock, renders the pill in every fixture state (both
// themes) and the history window, then composites each pill over three backgrounds.
// Output is deterministic: same code, same bytes. Writes to scripts/shots/out (gitignored).
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, "..", "..", "desktop");
const out = join(here, "out");
const require = createRequire(join(desktop, "package.json"));
const { chromium } = require("playwright");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);

// Wednesday 4 Nov 2026, 15:00 local. Every fixture is relative to this instant.
const NOW = new Date(2026, 10, 4, 15, 0, 0);
const STATES = ["running-under", "running-near", "running-over", "paused-recent", "paused-long"];
const THEMES = ["light", "dark"];
const PILL = { width: 248, height: 48 }; // must match tauri.conf.json "main"
const HISTORY = { width: 460, height: 780 }; // must match tauri.conf.json "settings"
const STAGE = { width: 360, height: 140 }; // pill composite canvas

// Backgrounds the pill has to survive on. CSS, so no binary assets and no drift.
const BACKGROUNDS = {
  "busy-light": `
    background-color: #e8e4dc;
    background-image:
      radial-gradient(circle at 18% 30%, #f7c6a4 0 60px, transparent 61px),
      radial-gradient(circle at 78% 70%, #a9c7e8 0 90px, transparent 91px),
      radial-gradient(circle at 60% 15%, #cfe6b8 0 45px, transparent 46px),
      repeating-linear-gradient(135deg, #0000 0 14px, #00000012 14px 16px),
      linear-gradient(90deg, #f3efe6, #d9d4ca);`,
  dark: `
    background-color: #15171c;
    background-image:
      radial-gradient(ellipse at 20% 80%, #2b3550 0, transparent 55%),
      radial-gradient(ellipse at 85% 20%, #4a2a3a 0, transparent 50%),
      repeating-linear-gradient(45deg, #0000 0 22px, #ffffff08 22px 23px);`,
  grey: "background: #808080;",
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const server = await createServer({ root: desktop, configFile: join(desktop, "vite.config.ts"), logLevel: "error", server: { port: 1420, strictPort: true } });
await server.listen();
const base = "http://localhost:1420/";
const browser = await chromium.launch();

async function openPage(colorScheme, viewport, url) {
  const ctx = await browser.newContext({ colorScheme, viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW);
  await page.goto(base + url);
  await page.waitForSelector("#root > *");
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

const shot = (page, opts = {}) => page.screenshot({ animations: "disabled", caret: "hide", ...opts });

const files = [];
const save = (name, buf) => {
  writeFileSync(join(out, name), buf);
  files.push(name);
};

// 1. Pill, every state, both themes, transparent background.
const pills = {};
for (const theme of THEMES) {
  for (const state of STATES) {
    const { ctx, page } = await openPage(theme, PILL, `?fixture=${state}`);
    const png = await shot(page, { omitBackground: true });
    pills[`${state}-${theme}`] = png;
    save(`pill-${state}-${theme}.png`, png);
    await ctx.close();
  }
}

// 2. Each pill composited over each background.
{
  const { ctx, page } = await openPage("light", STAGE, "?fixture=running-under");
  for (const [bg, css] of Object.entries(BACKGROUNDS)) {
    for (const [key, png] of Object.entries(pills)) {
      await page.setContent(
        `<style>html,body{margin:0;width:${STAGE.width}px;height:${STAGE.height}px;overflow:hidden}
         body{display:grid;place-items:center;${css}} img{display:block;image-rendering:pixelated}</style>
         <img width="${PILL.width}" height="${PILL.height}" src="data:image/png;base64,${png.toString("base64")}">`,
      );
      save(`over-${bg}-${key}.png`, await shot(page));
    }
  }
  await ctx.close();
}

// 3. History window, both themes, both chart views.
for (const theme of THEMES) {
  for (const view of ["totals", "timeline"]) {
    const { ctx, page } = await openPage(theme, HISTORY, `?window=settings&fixture=running-under`);
    await page.evaluate((v) => localStorage.setItem("history-view", v), view);
    await page.reload();
    await page.waitForSelector("#root > *");
    await page.evaluate(() => document.fonts.ready);
    // The window is a fixed-height inner scroller, so grow the viewport to show the whole page.
    const height = await page.evaluate(() => document.querySelector("main").scrollHeight);
    await page.setViewportSize({ width: HISTORY.width, height });
    save(`history-${view}-${theme}.png`, await shot(page));
    await ctx.close();
  }
}

await browser.close();
await server.close();

// Contact sheet for eyeballing everything at once.
const img = (f) => `<figure><img src="${f}"><figcaption>${f}</figcaption></figure>`;
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>shots</title>
<style>body{margin:24px;font:12px system-ui;background:#f4f4f4}section{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:32px}
figure{margin:0}img{display:block;max-width:100%;background:
repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}figcaption{color:#666;margin-top:4px}</style>
<h2>pill</h2><section>${files.filter((f) => f.startsWith("pill-")).map(img).join("")}</section>
<h2>over backgrounds</h2><section>${files.filter((f) => f.startsWith("over-")).map(img).join("")}</section>
<h2>history</h2><section>${files.filter((f) => f.startsWith("history-")).map(img).join("")}</section>`,
);
console.log(`${files.length} shots → ${out}`);
