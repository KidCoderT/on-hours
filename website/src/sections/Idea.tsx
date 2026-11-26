import { useRef } from "react";
import { useInView } from "motion/react";
import { DemoPill } from "../demo/DemoPill";
import { HOUR, useDemoTimer, type DemoState } from "../demo/useDemoTimer";
import { Bubble } from "../ui/Bubble";
import { Reveal } from "../ui/Reveal";

const MIN = 60_000;
const BEATS: { title: string; body: string; state: DemoState; bubble?: boolean }[] = [
  { title: "Press play when real work starts.", body: "The light turns yellow and the clock runs. Sitting at your desk doesn't count. Working does.", state: { elapsedMs: HOUR + 12 * MIN + 36_000, running: true, pausedMs: 0 } },
  { title: "Press pause when it stops.", body: "Coffee, phone, lunch: pause. Ctrl + Alt + Shift + O does it from any app. Stay away and the red light starts hopping. Stay away long enough and the whole pill grows and shakes.", state: { elapsedMs: 2 * HOUR + 5 * MIN + 44_000, running: false, pausedMs: 25 * MIN } },
  { title: "Hit your daily minimum.", body: "Set the number of hours you owe yourself. When you get there, the light goes green, the pill flashes and wiggles, and confetti flies. Then it offers a stretch: 30 more minutes, just for today. \"Not today\" and you're done.", state: { elapsedMs: 4 * HOUR + 12_000, running: true, pausedMs: 0 }, bubble: true },
];

function Beat({ index, title, body, state, bubble }: (typeof BEATS)[number] & { index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const { model } = useDemoTimer(state, { active: inView });
  return (
    <li ref={ref} className="idea-beat">
      <Reveal className="idea-copy" delay={0.05}>
        <span className="idea-num">0{index + 1}</span>
        <h3>{title}</h3>
        <p>{body}</p>
      </Reveal>
      <Reveal className="idea-pill" delay={0.15}>
        {/* Mounted only in view, so the long-pause bounce plays as you arrive. */}
        {inView && bubble && <Bubble title="Goal met." sub="Push another 30 min today?" buttons={["+30 min", "Not today"]} />}
        {inView && <DemoPill theme="baseline" model={model} />}
      </Reveal>
    </li>
  );
}

export function Idea() {
  return (
    <section className="section wrap" id="idea">
      <Reveal>
        <p className="eyebrow">How it works</p>
        <h2 className="section-title">One rule. Three states.</h2>
      </Reveal>
      <ol className="idea-list">
        {BEATS.map((b, i) => <Beat key={i} index={i} {...b} />)}
      </ol>
      <Reveal>
        <p className="idea-credit">
          The rule comes from Alex Hormozi: when you work, turn the timer on. When you stop, turn it off.
        </p>
      </Reveal>
    </section>
  );
}
