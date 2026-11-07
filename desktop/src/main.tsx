import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import App from "./App";
import Settings from "./Settings";
import { applyTheme, getTheme } from "./theme";
import "./styles.css";

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
  <React.StrictMode>{isSettings ? <Settings /> : <App />}</React.StrictMode>,
);
