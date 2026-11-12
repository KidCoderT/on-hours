// Screenshots of the real settings window for the website. From the repo root:
//   node scripts/shots/site.mjs
// Writes website/public/shots/settings-{light,dark}.png at 2x: the Preferences part only.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, "..", "..", "desktop");
const out = join(here, "..", "..", "website", "public", "shots");
const require = createRequire(join(desktop, "package.json"));
const { chromium } = require("playwright");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);

mkdirSync(out, { recursive: true });
const server = await createServer({ root: desktop, configFile: join(desktop, "vite.config.ts"), logLevel: "error", server: { port: 0, strictPort: false } });
await server.listen();
const browser = await chromium.launch();

let lastHeight = 0;
for (const mode of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: mode, viewport: { width: 460, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 10, 4, 15, 0, 0) });
  await page.goto(server.resolvedUrls.local[0] + "?window=settings&fixture=running-under&theme=baseline");
  await page.waitForSelector('html[data-app-theme="baseline"] main.settings');
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 460, height: await page.evaluate(() => document.querySelector("main").scrollHeight) });
  // The preview runs as a dev build, where "Open at login" is disabled. Show it as the installed app does.
  await page.evaluate(() => {
    const row = document.querySelector("#system-heading ~ .row"); // Open at login
    row.querySelector("small").textContent = "Start the timer when you sign in to Windows.";
    const box = row.querySelector("input");
    box.disabled = false;
    box.checked = true;
  });
  await page.addStyleTag({ content: "button.hotkey:disabled { opacity: 1 }" }); // it needs Tauri too; show it as the app does
  // From the "Preferences" heading down to the end of the last section.
  const clip = await page.evaluate(() => {
    const top = document.querySelector("h2.back-matter").getBoundingClientRect().top - 20;
    const sections = document.querySelectorAll("section.preferences");
    const bottom = sections[sections.length - 1].getBoundingClientRect().bottom + 16;
    return { x: 0, y: top, width: 450, height: bottom - top };
  });
  lastHeight = clip.height;
  await page.screenshot({ path: join(out, `settings-${mode}.png`), clip, animations: "disabled" });
  await ctx.close();
}

await browser.close();
await server.close();
console.log(`settings shots → ${out}; set SHOT_HEIGHT in website/src/sections/Settings.tsx to ${Math.round(lastHeight)}`);
