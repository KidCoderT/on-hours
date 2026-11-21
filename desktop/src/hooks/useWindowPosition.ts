import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";

/** Set while the alarm has the pill grown: that position is temporary and must not be saved. */
export const positionPinned = { current: false };

/**
 * Save this window's position shortly after each drag, so it survives a shutdown
 * (the plugin alone only saves on a clean quit).
 */
export function useWindowPosition() {
  useEffect(() => {
    if (!isTauri()) return;

    let timer: ReturnType<typeof setTimeout>;
    const unlisten = getCurrentWindow().onMoved(() => {
      clearTimeout(timer);
      timer = setTimeout(() => !positionPinned.current && saveWindowState(StateFlags.POSITION), 500);
    });

    return () => {
      clearTimeout(timer);
      unlisten.then((off) => off());
    };
  }, []);
}
