import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";
import { positionPinned } from "../hooks/useWindowPosition";

/** The pill's height in CSS px at zoom 1, as in tauri.conf.json. */
const PILL_HEIGHT = 48;

type Home = { current: { at: PhysicalPosition; grownAt: PhysicalPosition } | null };

/** Window moves run one at a time (fits here, the alarm's shake), so none reads a stale position. */
let queue = Promise.resolve();
export const onWindowQueue = (job: () => Promise<void>) => (queue = queue.then(job));

/**
 * Keep the pill window as big as the current theme needs, times `zoom` (the alarm grows the pill).
 *
 * - First fit after launch sizes in place. The window-state plugin restores position only, and the
 *   window always opens at tauri.conf.json's width, so anchoring here would drift the pill on
 *   every restart.
 * - A width change (style or settings button) keeps the right edge where it was, so a pill parked
 *   against the right side of the screen grows leftward instead of off-screen.
 * - Growing glides (about 240ms) and keeps the centre, inside the screen's work area. Shrinking glides back to
 *   exactly where it was, unless it was dragged while big. The drag-saver never saves a grown
 *   position, and if the app quits while grown, the next launch puts the pill back where it was.
 * - Fits always use the latest size, so fast clicking can't apply a stale one.
 * - Width changes: size first, then position, so a failed move leaves the window unanchored, never clipped.
 */
export function useFitWindow(width: number, enabled: boolean, zoom = 1) {
  const wanted = useRef({ width, zoom });
  const fitted = useRef<number | null>(null); // the zoom last fitted; null before the first fit
  const home = useRef<Home["current"]>(null); // where the pill was before it grew

  useEffect(() => {
    if (!enabled || !isTauri()) return;
    wanted.current = { width, zoom };
    onWindowQueue(async () => {
      const { width, zoom } = wanted.current;
      const before = fitted.current;
      await fit(width * zoom, PILL_HEIGHT * zoom, before === null ? "none" : before === zoom ? "right" : "centre", home);
      fitted.current = zoom;
    }).catch((e) => console.error("could not resize the pill", e));
  }, [width, zoom, enabled]);
}

async function fit(cssWidth: number, cssHeight: number, anchor: "none" | "right" | "centre", home: Home) {
  const win = getCurrentWindow();
  let [pos, size, scale] = await Promise.all([win.outerPosition(), win.innerSize(), win.scaleFactor()]);
  // The app quit while the pill was grown (tray Quit, an update): the plugin saved the grown spot
  // on the way out. Go back to where the pill was before it grew.
  const stranded = anchor === "none" && cssHeight === PILL_HEIGHT ? savedHome() : null;
  if (stranded) {
    await win.setPosition(stranded);
    pos = stranded;
    keepHome(null);
    await saveWindowState(StateFlags.POSITION);
  }
  const w = Math.round(cssWidth * scale);
  const h = Math.round(cssHeight * scale);
  const zoom = cssHeight / PILL_HEIGHT;
  if (w === size.width && h === size.height) return setZoom(zoom);
  const growing = h > size.height;
  if (growing) positionPinned.current = true; // before the move, so the drag-saver skips it

  let next: PhysicalPosition | null = null;
  if (anchor === "right") next = new PhysicalPosition(pos.x + size.width - w, pos.y);
  if (growing) {
    // Launched mid-alarm (anchor "none"): grow in place, and shrink back to here.
    if (anchor === "centre") next = await insideWorkArea(pos.x + (size.width - w) / 2, pos.y + (size.height - h) / 2, w, h);
    // Launched mid-alarm after a quit while grown: the home on disk is the real one.
    const at = (anchor === "none" && savedHome()) || pos;
    home.current = { at, grownAt: next ?? pos };
    keepHome(at);
  }
  if (anchor === "centre" && !growing) {
    const back = home.current;
    const undragged = back && back.grownAt.x === pos.x && back.grownAt.y === pos.y;
    next = undragged ? back.at : new PhysicalPosition(Math.round(pos.x + (size.width - w) / 2), Math.round(pos.y + (size.height - h) / 2));
    home.current = null;
    keepHome(null);
  }
  if (anchor === "centre") {
    await glide({ x: pos.x, y: pos.y, w: size.width, h: size.height }, { x: next!.x, y: next!.y, w, h }, size.height / scale / PILL_HEIGHT, zoom);
  } else {
    await win.setSize(new PhysicalSize(w, h));
    setZoom(zoom);
    if (next) await win.setPosition(next);
  }
  if (!growing && h === Math.round(PILL_HEIGHT * scale)) {
    positionPinned.current = false;
    await saveWindowState(StateFlags.POSITION);
  }
}

/** The pill's scale (the alarm grows it). The shell reads it: `.pill-shell { zoom: var(--pill-zoom) }`. */
const setZoom = (z: number) => document.documentElement.style.setProperty("--pill-zoom", String(z));

const GLIDE_MS = 240;
type Rect = { x: number; y: number; w: number; h: number };

/**
 * Animate the window from one rect to another, the pill's zoom following, one step per frame.
 * Growing moves the window first so the bigger pill always has room; shrinking zooms first.
 */
async function glide(from: Rect, to: Rect, zFrom: number, zTo: number) {
  const start = performance.now();
  for (let done = false; !done; ) {
    await new Promise((r) => setTimeout(r, 16)); // not rAF: a hidden window never gets one, and this queue must not stall
    const t = Math.min(1, (performance.now() - start) / GLIDE_MS);
    done = t === 1;
    const e = 1 - (1 - t) ** 3; // ease-out: fast start, gentle landing
    const at = (a: number, b: number) => Math.round(a + (b - a) * e);
    const bounds = invoke("set_bounds", { x: at(from.x, to.x), y: at(from.y, to.y), width: at(from.w, to.w), height: at(from.h, to.h) });
    const z = zFrom + (zTo - zFrom) * e;
    if (zTo > zFrom) {
      await bounds;
      setZoom(z);
    } else {
      setZoom(z);
      await bounds;
    }
  }
}

/**
 * Where a grown pill belongs, kept on disk (WebView2 keeps localStorage) until it shrinks, so a quit
 * while grown can't strand it. Storage can be missing or refused: then the pill just stays put.
 */
const HOME_KEY = "pill-home";
function savedHome() {
  try {
    const p = JSON.parse(localStorage.getItem(HOME_KEY) ?? "null");
    return Number.isFinite(p?.x) && Number.isFinite(p?.y) ? new PhysicalPosition(p.x, p.y) : null;
  } catch {
    return null;
  }
}
function keepHome(p: PhysicalPosition | null) {
  try {
    if (p) localStorage.setItem(HOME_KEY, JSON.stringify({ x: p.x, y: p.y }));
    else localStorage.removeItem(HOME_KEY);
  } catch {
    // ponytail: no storage, no restore; the pill opens where the plugin saved it.
  }
}

/** Nudge a w×h window at (x, y) back inside its monitor's work area (the screen minus the taskbar). */
async function insideWorkArea(x: number, y: number, w: number, h: number) {
  const area = (await currentMonitor())?.workArea;
  if (!area) return new PhysicalPosition(Math.round(x), Math.round(y));
  const clamp = (v: number, lo: number, len: number, size: number) => Math.round(Math.min(Math.max(v, lo), lo + len - size));
  return new PhysicalPosition(clamp(x, area.position.x, area.size.width, w), clamp(y, area.position.y, area.size.height, h));
}
