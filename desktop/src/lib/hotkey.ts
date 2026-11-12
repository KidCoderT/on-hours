// The global pause/resume hotkey as text, e.g. "Ctrl+Alt+Shift+O". Pure: the settings window
// builds it from a key press, and Rust (set_hotkey in lib.rs) parses it.

/** Not a key on its own; pressing one of these only adds a modifier. */
const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;

type Press = Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "code">;

/**
 * The combo for this key press, or null while it is still incomplete: only modifiers so far, or no
 * modifier at all (a bare letter as a global hotkey would steal that key from every app).
 * Uses the physical key (`code`), so the combo means the same on any keyboard layout.
 */
export function comboFromPress(e: Press): string | null {
  if (!e.code || MODIFIER_CODES.test(e.code)) return null;
  if (!(e.ctrlKey || e.altKey || e.shiftKey)) return null;
  const key = e.code.replace(/^Key|^Digit/, "");
  return [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", key].filter(Boolean).join("+");
}

/** "Ctrl+Alt+Shift+O" → "Ctrl + Alt + Shift + O" for display. */
export const showCombo = (combo: string) => combo.split("+").join(" + ");
