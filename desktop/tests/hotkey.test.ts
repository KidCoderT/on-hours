import { expect, test } from "bun:test";
import { comboFromPress, showCombo } from "../src/lib/hotkey";
import { DEFAULT_SETTINGS, parseSettings } from "../src/lib/settings";

const press = (code: string, mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey", true>> = {}) =>
  comboFromPress({ ctrlKey: false, altKey: false, shiftKey: false, code, ...mods });

test("a press becomes a combo only when it has a real key and a modifier", () => {
  expect(press("KeyO", { ctrlKey: true, altKey: true, shiftKey: true })).toBe("Ctrl+Alt+Shift+O");
  expect(press("Digit1", { altKey: true })).toBe("Alt+1");
  expect(press("Space", { ctrlKey: true, shiftKey: true })).toBe("Ctrl+Shift+Space");
  expect(press("F9", { ctrlKey: true })).toBe("Ctrl+F9");
  expect(press("ControlLeft", { ctrlKey: true })).toBeNull(); // still holding modifiers
  expect(press("ShiftRight", { shiftKey: true })).toBeNull();
  expect(press("KeyO")).toBeNull(); // a bare key would be stolen from every app
});

test("combos display with spaces", () => {
  expect(showCombo("Ctrl+Alt+Shift+O")).toBe("Ctrl + Alt + Shift + O");
});

test("the hotkey setting: default when missing, \"\" means off, otherwise as saved", () => {
  expect(parseSettings({}).hotkey).toBe(DEFAULT_SETTINGS.hotkey);
  expect(parseSettings({ hotkey: "" }).hotkey).toBe("");
  expect(parseSettings({ hotkey: " Ctrl+Alt+P " }).hotkey).toBe("Ctrl+Alt+P");
});
