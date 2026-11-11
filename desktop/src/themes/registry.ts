import BaselinePill from "./baseline/Pill";
import InstrumentPill from "./instrument/Pill";
import LedgerPill from "./ledger/Pill";
// App looks: the settings window takes the active theme's colours, font and control styling.
// An app.css restyles the shared markup; it never adds or moves any.
import "./instrument/app.css";
import "./ledger/app.css";
import type { PillTheme } from "./types";

// Adding a theme: a folder with Pill.tsx + pill.css (rules in types.ts), an optional app.css
// imported above, one entry here, one id in scripts/shots/shoot.mjs. Themes are imported eagerly:
// they are small, and a failed lazy chunk would leave an invisible pill with no way back.
export const THEMES = [
  {
    id: "baseline",
    name: "Baseline",
    blurb: "A Mac panel. A traffic light and a plain number.",
    api: 1,
    width: { withButton: 232, bare: 200 },
    Pill: BaselinePill,
  },
  {
    id: "instrument",
    name: "Instrument",
    blurb: "Hardware readout. Status lives in the digits.",
    api: 1,
    width: { withButton: 282, bare: 248 },
    Pill: InstrumentPill,
  },
  {
    id: "ledger",
    name: "Ledger",
    blurb: "Today's line in the book. Ink, pencil, red ink.",
    api: 1,
    width: { withButton: 252, bare: 220 },
    Pill: LedgerPill,
  },
] as const satisfies readonly PillTheme[];

export type ThemeId = (typeof THEMES)[number]["id"];

/** Unknown or retired ids (an older build, a hand-edited database) fall back to the first theme. */
export const themeById = (id: string): PillTheme => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const pillWidth = (theme: PillTheme, withButton: boolean) => (withButton ? theme.width.withButton : theme.width.bare);
