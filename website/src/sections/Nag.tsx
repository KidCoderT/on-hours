import { useRef } from "react";
import { useInView } from "motion/react";
import { DemoPill } from "../demo/DemoPill";
import { HOUR, useDemoTimer, type DemoState } from "../demo/useDemoTimer";
import { Reveal } from "../ui/Reveal";

const MIN = 60_000;
const BREAKS = [10, 15, 30];

// The app's pause stages, each held at a moment inside it (default settings: long pause 20 min, alarm at 1.5x).
const STAGES: { when: string; title: string; body: string; state: DemoState }[] = [
  { when: "0 – 5 min", title: "Short pause", body: "A red light, nothing more. Grab a coffee.", state: { elapsedMs: 2 * HOUR + 5 * MIN, running: false, pausedMs: 2 * MIN } },
  { when: "5 min", title: "Nudge", body: "The light hops every 20 seconds, like a Dock icon asking for you.", state: { elapsedMs: 2 * HOUR + 5 * MIN, running: false, pausedMs: 8 * MIN } },
  { when: "20 min", title: "Long pause", body: "It hops every 5 seconds, glowing, and the number turns red.", state: { elapsedMs: 2 * HOUR + 5 * MIN, running: false, pausedMs: 24 * MIN } },
  { when: "30 min", title: "Alarm", body: "The pill grows, shakes, and flashes its taskbar button until you come back.", state: { elapsedMs: 2 * HOUR + 5 * MIN, running: false, pausedMs: 45 * MIN } },
];

function Stage({ when, title, body, state }: (typeof STAGES)[number]) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const { model } = useDemoTimer(state, { active: inView });
  return (
    <li ref={ref} className="nag-stage" data-stage={model.pause}>
      <div className="nag-pill">{inView && <DemoPill theme="baseline" model={model} />}</div>
      <span className="nag-when">{when}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  );
}

/** A working copy of the pill's right-click menu, driving a live pill. */
function BreakDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const { model, takeBreak, set } = useDemoTimer({ elapsedMs: 2 * HOUR + 5 * MIN, running: false, pausedMs: 8 * MIN }, { active: inView });
  const onBreak = model.pause === "break";
  return (
    <div ref={ref} className="break-demo">
      <div className="pill-menu" role="group" aria-label="The pill's right-click menu">
        {onBreak ? (
          <button type="button" onClick={() => set((s) => ({ ...s, breakLeftMs: 0, pausedMs: 0, afterBreak: true }))}>End break</button>
        ) : (
          BREAKS.map((min) => (
            <button type="button" key={min} onClick={() => takeBreak(min * MIN)}>Take a {min} min break</button>
          ))
        )}
        <hr />
        <span>Settings</span>
      </div>
      <div className="break-pill"><DemoPill theme="baseline" model={model} /></div>
    </div>
  );
}

export function Nag() {
  return (
    <section className="section wrap" id="nag">
      <Reveal>
        <p className="eyebrow">Hard to ignore</p>
        <h2 className="section-title">Walk away, and it notices.</h2>
        <p className="section-lead">
          A paused timer is easy to stop seeing. So the longer the pause, the louder the pill gets, until working
          is easier than ignoring it.
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <ol className="nag-ladder">
          {STAGES.map((s) => <Stage key={s.title} {...s} />)}
        </ol>
      </Reveal>
      <p className="nag-note">
        Once today's goal is met, it stops asking. The alarm time is yours to set: 1.5 long pauses by default.
      </p>

      <div className="break-layout">
        <Reveal className="break-copy">
          <h3>A real break? Say so.</h3>
          <p>
            Right-click the pill and take 10, 15 or 30 minutes. The clock turns blue and counts the break down, and
            nothing nags. Stay away past the end and it nudges you straight away. Breaks show up in your history.
          </p>
          <p className="break-try">Try it: pick a break.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <BreakDemo />
        </Reveal>
      </div>
    </section>
  );
}
