// Design comparison. From the repo root:  bun run --cwd desktop compare
//
// Reads design/compare/shots/<variant>/ (copied from each design worktree's scripts/shots/out)
// and writes one contact sheet per state to design/compare/sheets/ plus design/compare/index.html.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const compare = join(root, "design", "compare");
const shots = join(compare, "shots");
const sheets = join(compare, "sheets");
const { chromium } = createRequire(join(root, "desktop", "package.json"))("playwright");

const VARIANTS = ["baseline", "instrument", "ledger", "panel"];
const STATES = ["running-under", "running-near", "running-over", "paused-recent", "paused-long"];
const BGS = ["busy-light", "dark", "grey"];
const THEMES = ["light", "dark"];
const VIEWS = ["totals", "timeline"];

const has = (v, f) => existsSync(join(shots, v, f));
const uri = (v, f) => `data:image/png;base64,${readFileSync(join(shots, v, f)).toString("base64")}`;
const missing = [];

// ---------- 1. Contact sheets: rows = background × theme, columns = variants ----------

const SHEET_CSS = `
  html, body { margin: 0; }
  body { display: inline-block; padding: 24px; background: #f4f4f4; font: 12px/16px "Segoe UI", system-ui, sans-serif; color: #333; }
  h1 { margin: 0 0 16px; font-size: 16px; line-height: 20px; }
  .grid { display: grid; grid-template-columns: repeat(${VARIANTS.length}, max-content); gap: 20px 16px; align-items: start; }
  figure { margin: 0; }
  img { display: block; }
  figcaption { margin-top: 6px; }
  figcaption b { color: #000; }
  .gap { display: grid; place-items: center; border: 1px dashed #aaa; color: #888; }`;

function cell(v, file, caption, w, h) {
  if (!has(v, file)) {
    missing.push(`${v}/${file}`);
    return `<figure><div class="gap" style="width:${w}px;height:${h}px">missing</div><figcaption><b>${v}</b> · ${caption}</figcaption></figure>`;
  }
  return `<figure><img src="${uri(v, file)}"><figcaption><b>${v}</b> · ${caption}</figcaption></figure>`;
}

const sheetRows = (rows) => rows.map(({ file, caption, w, h }) => VARIANTS.map((v) => cell(v, file, caption, w, h)).join("")).join("");

const SHEETS = [
  ...STATES.map((s) => ({
    name: s,
    rows: BGS.flatMap((bg) => THEMES.map((t) => ({ file: `over-${bg}-${s}-${t}.png`, caption: `${bg} wallpaper · ${t} theme`, w: 360, h: 140 }))),
  })),
  {
    name: "history-window",
    rows: VIEWS.flatMap((view) => THEMES.map((t) => ({ file: `history-${view}-${t}.png`, caption: `${view} · ${t} theme`, w: 460, h: 780 }))),
  },
];

rmSync(sheets, { recursive: true, force: true });
mkdirSync(sheets, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 800 }, deviceScaleFactor: 1 });
for (const { name, rows } of SHEETS) {
  await page.setContent(`<!doctype html><style>${SHEET_CSS}</style><h1>${name}</h1><div class="grid">${sheetRows(rows)}</div>`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await page.locator("body").screenshot({ path: join(sheets, `${name}.png`), animations: "disabled" });
}
await browser.close();

// ---------- 2. index.html: rows = states, columns = variants, switchable wallpaper / theme / chart view ----------

// Shots that exist for one variant only (captured outside the shared harness), shown as their own row.
const extras = [...new Set(VARIANTS.flatMap((v) =>
  (existsSync(join(shots, v)) ? readdirSync(join(shots, v)) : []).filter((f) => f.startsWith("extra-")).map((f) => f.replace(/^extra-(.+?)-over-.*$/, "$1")),
))];

const head = VARIANTS.map((v) => `<th scope="col">${v}</th>`).join("");
const row = (label, note, kind, state) =>
  `<tr><th scope="row">${label}${note ? `<small>${note}</small>` : ""}</th>${VARIANTS.map((v) =>
    kind === "extra" && !readdirSync(join(shots, v)).some((f) => f.startsWith(`extra-${state}-`))
      ? `<td><span class="gap">this design has no ${state} state</span></td>`
      : `<td><img data-v="${v}" data-kind="${kind}" data-state="${state}" alt="${v} ${label}"><span class="gap" hidden>not captured</span></td>`).join("")}</tr>`;

const body = [
  ...STATES.map((s) => row(s, "", "pill", s)),
  ...extras.map((s) => row(s, "extra state, captured outside the harness; composites only", "extra", s)),
  row("history-window", "wallpaper does not apply", "history", ""),
].join("\n");

writeFileSync(join(compare, "index.html"), `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Design comparison</title>
<style>
  body { margin: 0; font: 13px/18px "Segoe UI", system-ui, sans-serif; color: #222; background: #f4f4f4; }
  .bar { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; padding: 12px 16px; background: #fff; border-bottom: 1px solid #ddd; }
  .bar h1 { margin: 0 8px 0 0; font-size: 15px; }
  fieldset { display: flex; gap: 10px; margin: 0; padding: 0; border: 0; }
  legend { float: left; margin-right: 8px; color: #666; }
  table { border-collapse: separate; border-spacing: 0; }
  thead th { position: sticky; top: 0; z-index: 1; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 16px; text-align: left; font-size: 14px; }
  thead th:first-child { left: 0; z-index: 2; }
  tbody th { position: sticky; left: 0; background: #f4f4f4; text-align: left; vertical-align: top; padding: 16px; width: 140px; font-weight: 600; }
  tbody th small { display: block; font-weight: 400; color: #777; margin-top: 4px; }
  td { vertical-align: top; padding: 16px; border-bottom: 1px solid #e2e2e2; }
  img { display: block; max-width: none; }
  img.checker { background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
  .gap { display: inline-block; padding: 8px 12px; border: 1px dashed #aaa; color: #888; }
</style>
<div class="bar">
  <h1>Design comparison</h1>
  <fieldset><legend>Wallpaper</legend>
    ${[...BGS, "none"].map((b, i) => `<label><input type="radio" name="bg" value="${b}"${i ? "" : " checked"}> ${b === "none" ? "none (transparent)" : b}</label>`).join("\n    ")}
  </fieldset>
  <fieldset><legend>Theme</legend>
    ${THEMES.map((t, i) => `<label><input type="radio" name="theme" value="${t}"${i ? "" : " checked"}> ${t}</label>`).join("\n    ")}
  </fieldset>
  <fieldset><legend>History chart</legend>
    ${VIEWS.map((c, i) => `<label><input type="radio" name="view" value="${c}"${i ? "" : " checked"}> ${c}</label>`).join("\n    ")}
  </fieldset>
</div>
<table>
  <thead><tr><th></th>${head}</tr></thead>
  <tbody>
${body}
  </tbody>
</table>
<script>
  const pick = (n) => document.querySelector('input[name="' + n + '"]:checked').value;
  function file(img, bg, theme, view) {
    const { kind, state } = img.dataset;
    if (kind === "history") return "history-" + view + "-" + theme + ".png";
    if (bg === "none") return kind === "extra" ? null : "pill-" + state + "-" + theme + ".png";
    return (kind === "extra" ? "extra-" : "over-") + (kind === "extra" ? state + "-over-" : "") + bg + "-" + (kind === "extra" ? "" : state + "-") + theme + ".png";
  }
  function render() {
    const bg = pick("bg"), theme = pick("theme"), view = pick("view");
    for (const img of document.querySelectorAll("td img")) {
      const f = file(img, bg, theme, view);
      const gap = img.nextElementSibling;
      img.classList.toggle("checker", bg === "none" && img.dataset.kind !== "history");
      img.onerror = () => { img.hidden = true; gap.hidden = false; };
      img.hidden = !f; gap.hidden = !!f;
      if (f) img.src = "shots/" + img.dataset.v + "/" + f;
    }
  }
  document.querySelectorAll(".bar input").forEach((i) => i.addEventListener("change", render));
  render();
</script>
</html>
`);

console.log(`${SHEETS.length} sheets → ${sheets}`);
console.log(`index → ${join(compare, "index.html")}`);
if (extras.length) console.log(`variant-only states: ${extras.join(", ")}`);
if (missing.length) console.log(`missing:\n  ${missing.join("\n  ")}`);
