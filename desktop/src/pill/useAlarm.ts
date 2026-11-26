import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition, UserAttentionType } from "@tauri-apps/api/window";
import { onWindowQueue } from "./useFitWindow";

/** How often the alarm shakes the pill and flashes its taskbar button again. */
const BURST_MS = 30_000;
/** Shake offsets in physical px, one per frame: a quick "no" that settles back where it was. */
const SHAKE = [12, -12, 9, -9, 6, -6, 3, -3, 0];
const FRAME_MS = 35;

const fail = (e: unknown) => console.error("alarm failed", e);

/**
 * The alarm stage reaching outside the pill: the pill gets a taskbar button that flashes until
 * clicked, and the window shakes, both again every 30s. The pill's growing is useFitWindow's job.
 * When the alarm ends (work starts, or a break) the taskbar button goes away again.
 */
export function useAlarm(on: boolean) {
  useEffect(() => {
    if (!on || !isTauri()) return;
    const win = getCurrentWindow();
    const burst = () => {
      win.requestUserAttention(UserAttentionType.Critical).catch(fail);
      onWindowQueue(() => shake()).catch(fail);
    };
    // A hidden pill is a forgotten timer: bring it back, with a taskbar button to flash.
    win.show().then(() => win.setSkipTaskbar(false)).then(burst).catch(fail);
    const id = setInterval(burst, BURST_MS);
    return () => {
      clearInterval(id);
      win.requestUserAttention(null).catch(fail);
      win.setSkipTaskbar(true).catch(fail);
    };
  }, [on]);
}

/** Jolt the window side to side through `offsets` (physical px), back to where it was. */
export async function shake(offsets = SHAKE) {
  const win = getCurrentWindow();
  const { x, y } = await win.outerPosition();
  for (const dx of offsets) {
    await win.setPosition(new PhysicalPosition(x + dx, y));
    await new Promise((r) => setTimeout(r, FRAME_MS));
  }
}
