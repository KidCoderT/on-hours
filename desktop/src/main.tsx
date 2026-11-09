import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import PillWindow from "./pill/PillWindow";
import SettingsWindow from "./windows/settings/SettingsWindow";
import { applyTheme, getTheme } from "./lib/theme";
import "./styles/tokens.css";

// Restore before enabling color interpolation in each window.
const themeRestored = isTauri() ? applyTheme(getTheme()) : Promise.resolve();
void themeRestored.finally(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.add("theme-ready");
  }));
});

// Both windows load this same page; the window label picks what to show.
// In a plain browser (design preview at localhost:1420), use ?window=settings.
const label = isTauri()
  ? getCurrentWindow().label
  : new URLSearchParams(location.search).get("window");
const isSettings = label === "settings";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isSettings ? <SettingsWindow /> : <PillWindow />}</React.StrictMode>,
);
