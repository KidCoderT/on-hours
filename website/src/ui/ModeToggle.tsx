import { useState } from "react";

type Mode = "light" | "dark";
const root = document.documentElement;

/**
 * Light/dark button. The page starts in the device's mode (index.html sets data-mode before first
 * paint); pressing this overrides it and the choice is remembered.
 */
export function ModeToggle() {
  const [mode, setMode] = useState<Mode>(root.dataset.mode === "dark" ? "dark" : "light");
  const flip = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    root.dataset.mode = next;
    localStorage.setItem("mode", next);
    setMode(next);
  };
  return (
    <button type="button" className="mode-toggle" onClick={flip} aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={mode === "dark" ? "Light mode" : "Dark mode"}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" data-mode={mode}>
        {/* Sun and moon share the spot; site.css turns one out and the other in. */}
        <g className="mode-sun" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
        <path className="mode-moon" fill="currentColor" d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.6 8.6 0 1 0 10.6 10.6Z" />
      </svg>
    </button>
  );
}
