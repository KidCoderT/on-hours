import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ANSWER, HIDE, SHOW, type BubbleAnswer, type BubbleHide, type BubbleShow } from "../../lib/bubble";
import "./bubble.css";

type Phase = "in" | "drop" | "quiet";

/**
 * The away bubble. Rises in when shown, falls back toward the pill once answered, and fades away
 * by itself (after a beat) when the person comes back without answering. Hides its window when done.
 * Styled after the pill's theme. Design preview: ?window=bubble&kind=check&theme=ledger.
 */
function BubbleWindow() {
  const [bubble, setBubble] = useState<BubbleShow | null>(preview);
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const offShow = win.listen<BubbleShow>(SHOW, (e) => {
      setBubble(e.payload);
      setPhase("in");
    });
    const offHide = win.listen<BubbleHide>(HIDE, (e) => setPhase(e.payload.how));
    return () => {
      offShow.then((off) => off());
      offHide.then((off) => off());
    };
  }, []);

  if (!bubble) return null;
  const primary = bubble.primary ?? "yes";

  const answer = (yes: boolean) => {
    if (phase !== "in") return;
    void emitTo("main", ANSWER, { kind: bubble.kind, yes } satisfies BubbleAnswer).catch((e) => console.error("could not answer", e));
    setPhase("drop");
  };

  // Once a leaving animation ends, clear and hide the window, ready for next time.
  const onAnimationEnd = (e: React.AnimationEvent) => {
    if (e.target !== e.currentTarget || phase === "in") return;
    setBubble(null);
    if (isTauri()) void getCurrentWindow().hide().catch((err) => console.error("could not hide the bubble", err));
  };

  return (
    <div className="bubble-stage" data-below={bubble.below}>
      <div key={bubble.kind} className="bubble" data-theme={bubble.theme} data-phase={phase} role="alertdialog" aria-label={bubble.title} onAnimationEnd={onAnimationEnd}>
        <p className="bubble-title">{bubble.title}</p>
        {bubble.sub && <p className="bubble-sub">{bubble.sub}</p>}
        {bubble.kind !== "paused" && (
          <div className="bubble-actions">
            <button type="button" className={primary === "yes" ? "bubble-primary" : undefined} onClick={() => answer(true)}>Yes</button>
            <button type="button" className={primary === "no" ? "bubble-primary" : undefined} onClick={() => answer(false)}>No</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** In a plain browser, ?window=bubble&kind=…&theme=… shows a sample, for design work. */
const preview: BubbleShow | null = (() => {
  if (isTauri()) return null;
  const q = new URLSearchParams(location.search);
  const kind = (q.get("kind") ?? "check") as BubbleShow["kind"];
  const text = { check: ["Hey, you still there?", "No keyboard or mouse since 14:02."], paused: ["Paused.", "Away since 14:02. I'll ask when you're back."], count: ["Was that 34 min work?", "Away 14:02 – 14:36"] }[kind];
  return { kind, title: text[0], sub: text[1], primary: kind === "count" ? "no" : "yes", theme: q.get("theme") ?? "baseline", below: q.get("below") === "1" };
})();

export default BubbleWindow;
