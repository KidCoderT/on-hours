// Screenshot harness. From the repo root:  bun run --cwd desktop shots
//
// Starts Vite, freezes the browser clock, and renders every pill theme in every fixture state,
// with and without its settings button, in light and dark. Composites each pill over three
// backgrounds and captures the settings window.
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
// Must list every theme in desktop/src/themes/registry.ts; the run fails if it doesn't.
const PILL_THEMES = ["baseline", "instrument", "ledger"];
const STATES = ["running-under", "running-near", "running-over", "paused-recent", "paused-long"];
const MODES = ["light", "dark"];
const PILL_HEIGHT = 48;
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

const server = await createServer({ root: desktop, configFile: join(desktop, "vite.config.ts"), logLevel: "error", server: { port: 0, strictPort: false } }); // any free port: never collides with `tauri dev`
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const problems = [];

async function openPage(colorScheme, viewport, url, ready) {
  const ctx = await browser.newContext({ colorScheme, viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW);
  await page.goto(base + url);
  await page.waitForSelector(ready);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

const shot = (page, opts = {}) => page.screenshot({ animations: "disabled", caret: "hide", ...opts });

const files = [];
const save = (name, buf) => {
  writeFileSync(join(out, name), buf);
  files.push(name);
};

/** Render one pill at the width the app would give its window, and check it fits. */
async function pill(theme, state, mode, button) {
  const { ctx, page } = await openPage(mode, { width: 400, height: PILL_HEIGHT }, `?fixture=${state}&theme=${theme}&button=${button ? 1 : 0}`, `.pill[data-theme="${theme}"]`);
  const { width, themes } = await page.evaluate(() => ({ width: Number(document.documentElement.dataset.pillWidth), themes: document.documentElement.dataset.themes }));
  if (themes !== PILL_THEMES.join(" ")) problems.push(`registry has [${themes}], harness has [${PILL_THEMES.join(" ")}]`);
  await page.setViewportSize({ width, height: PILL_HEIGHT });
  const overflow = await page.evaluate(() => {
    const el = document.querySelector(".pill");
    return el.scrollWidth > el.clientWidth || el.getBoundingClientRect().width !== window.innerWidth ? el.scrollWidth : 0;
  });
  if (overflow) problems.push(`${theme} ${state} button=${button}: content is ${overflow}px in a ${width}px window`);
  const png = await shot(page, { omitBackground: true });
  await ctx.close();
  return { png, width };
}

// 1. Every theme × state × mode, with and without the settings button, transparent background.
const pills = [];
for (const theme of PILL_THEMES) {
  for (const mode of MODES) {
    for (const state of STATES) {
      for (const button of [true, false]) {
        const { png, width } = await pill(theme, state, mode, button);
        const name = `pill-${theme}-${state}-${mode}${button ? "" : "-bare"}`;
        save(`${name}.png`, png);
        if (button) pills.push({ name, png, width });
      }
    }
  }
}

// 2. Each default pill (button on) composited over each background.
{
  const { ctx, page } = await openPage("light", STAGE, "?fixture=running-under", ".pill");
  for (const [bg, css] of Object.entries(BACKGROUNDS)) {
    for (const { name, png, width } of pills) {
      await page.setContent(
        `<style>html,body{margin:0;width:${STAGE.width}px;height:${STAGE.height}px;overflow:hidden}
         body{display:grid;place-items:center;${css}} img{display:block;image-rendering:pixelated}</style>
         <img width="${width}" height="${PILL_HEIGHT}" src="data:image/png;base64,${png.toString("base64")}">`,
      );
      save(`over-${bg}-${name.replace(/^pill-/, "")}.png`, await shot(page));
    }
  }
  await ctx.close();
}

// 3. Settings window in each theme's palette and font, both modes, both chart views.
for (const theme of PILL_THEMES) {
  for (const mode of MODES) {
    for (const view of ["totals", "timeline"]) {
      const ready = `html[data-app-theme="${theme}"] main.settings`;
      const { ctx, page } = await openPage(mode, HISTORY, `?window=settings&fixture=running-under&theme=${theme}`, ready);
      await page.evaluate((v) => localStorage.setItem("history-view", v), view);
      await page.reload();
      await page.waitForSelector(ready);
      await page.evaluate(() => document.fonts.ready);
      // Wider fonts (mono, serif) must not push anything past the window's edge.
      const wide = await page.evaluate(() => {
        const main = document.querySelector("main");
        return main.scrollWidth > main.clientWidth ? main.scrollWidth : 0;
      });
      if (wide) problems.push(`settings ${theme} ${mode} ${view}: content is ${wide}px wide`);
      // The window is a fixed-height inner scroller, so grow the viewport to show the whole page.
      const height = await page.evaluate(() => document.querySelector("main").scrollHeight);
      await page.setViewportSize({ width: HISTORY.width, height });
      save(`settings-${theme}-${view}-${mode}.png`, await shot(page));
      await ctx.close();
    }
  }
}

await browser.close();
await server.close();

// Contact sheet for eyeballing everything at once.
const img = (f) => `<figure><img src="${f}"><figcaption>${f}</figcaption></figure>`;
const section = (title, prefix) => `<h2>${title}</h2><section>${files.filter((f) => f.startsWith(prefix)).map(img).join("")}</section>`;
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>shots</title>
<style>body{margin:24px;font:12px system-ui;background:#f4f4f4}section{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:32px}
figure{margin:0}img{display:block;max-width:100%;background:
repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}figcaption{color:#666;margin-top:4px}</style>
${PILL_THEMES.map((t) => section(`pill: ${t}`, `pill-${t}-`)).join("")}
${section("over backgrounds", "over-")}
${section("settings", "settings-")}`,
);
console.log(`${files.length} shots → ${out}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
