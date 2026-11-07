import { setTheme } from "@tauri-apps/api/app";

export type ThemeChoice = "system" | "light" | "dark";

// ponytail: localStorage until settings move to SQLite.
export const getTheme = (): ThemeChoice =>
  (localStorage.getItem("theme") as ThemeChoice) ?? "system";

// Sets the theme for every window; CSS follows via prefers-color-scheme.
export function applyTheme(choice: ThemeChoice) {
  localStorage.setItem("theme", choice);
  return setTheme(choice === "system" ? null : choice);
}
