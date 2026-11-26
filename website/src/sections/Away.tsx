import { useRef } from "react";
import { useInView } from "motion/react";
import { DemoPill } from "../demo/DemoPill";
import { HOUR, useDemoTimer, type DemoState } from "../demo/useDemoTimer";
import { Bubble } from "../ui/Bubble";
import { Reveal } from "../ui/Reveal";

const MIN = 60_000;

// What pill/useTimer.ts does when you walk off with the clock running (default settings: check in 10 min, pause 20 min).
const STEPS: { when: string; title: string; body: string; bubble: Parameters<typeof Bubble>[0]; state: DemoState }[] = [
  {
    when: "10 min, no input",
    title: "It checks in.",
    body: "The clock keeps running and a bubble asks. Yes carries on. No pauses it at your last keystroke, so the quiet time doesn't count. Just come back and it counts.",
    bubble: { title: "Hey, you still there?", sub: "No keyboard or mouse since 14:02.", buttons: ["Yes", "No"] },
    state: { elapsedMs: 2 * HOUR + 18 * MIN, running: true, pausedMs: 0 },
  },
  {
    when: "20 min, or a locked PC",
    title: "It pauses itself.",
    body: "Gone long enough, or locked the screen, and the timer stops at the moment you last touched the keyboard or mouse. Not when it noticed.",
    bubble: { title: "Paused.", sub: "Away since 14:02." },
    state: { elapsedMs: 2 * HOUR + 8 * MIN, running: false, pausedMs: 21 * MIN },
  },
  {
    when: "Back at the desk",
    title: "It asks what that was.",
    body: "On a call or at the whiteboard? Count it puts the time back. Start now leaves it out and starts fresh. Ignore it and the time stays out.",
    bubble: { title: "Welcome back.", sub: "Away 34 min, since 14:02.", buttons: ["Count it", "▶ Start now"], primary: 1 },
    state: { elapsedMs: 2 * HOUR + 8 * MIN, running: false, pausedMs: 34 * MIN },
  },
];

function Step({ when, title, body, bubble, state }: (typeof STEPS)[number]) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const { model } = useDemoTimer(state, { active: inView });
  return (
    <li ref={ref} className="nag-stage away-step">
      <div className="away-art">
        {inView && <Bubble {...bubble} />}
        {inView && <DemoPill theme="baseline" model={model} />}
      </div>
      <span className="nag-when">{when}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  );
}

export function Away() {
  return (
    <section className="section wrap" id="away">
      <Reveal>
        <p className="eyebrow">Away</p>
        <h2 className="section-title">Forgot to pause? It didn't.</h2>
        <p className="section-lead">
          Walk off with the clock running and it won't quietly pad your day. It watches for keyboard and mouse
          activity, never what you type, and asks before it counts.
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <ol className="away-steps">
          {STEPS.map((s) => <Step key={s.title} {...s} />)}
        </ol>
      </Reveal>
      <p className="nag-note">Both times are yours to set, or turn off. Locking the PC always pauses.</p>
    </section>
  );
}
