import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { THEMES, type ThemeId } from "@app/themes/registry";
import { DemoPill } from "../demo/DemoPill";
import { HOUR, useDemoTimer, type DemoState } from "../demo/useDemoTimer";
import { Reveal } from "../ui/Reveal";
import { Segmented } from "../ui/Segmented";

const MIN = 60_000;
const STATES = {
  working: { label: "Working", state: { elapsedMs: HOUR + 12 * MIN + 36_000, running: true, pausedMs: 0 } },
  paused: { label: "Paused", state: { elapsedMs: 2 * HOUR + 5 * MIN + 44_000, running: false, pausedMs: 4 * MIN } },
  long: { label: "Long pause", state: { elapsedMs: 48 * MIN + 10_000, running: false, pausedMs: 2 * HOUR + 50 * MIN } },
  met: { label: "Goal met", state: { elapsedMs: 4 * HOUR + 37 * MIN + 12_000, running: true, pausedMs: 0 } },
} satisfies Record<string, { label: string; state: DemoState }>;
type StateId = keyof typeof STATES;

export function Styles() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [theme, setTheme] = useState<ThemeId>("baseline");
  const [stateId, setStateId] = useState<StateId>("working");
  const { model, set } = useDemoTimer(STATES.working.state, { active: inView });
  const current = THEMES.find((t) => t.id === theme)!;

  const pickState = (id: StateId) => {
    setStateId(id);
    set(STATES[id].state);
  };

  return (
    <section className="section wrap" id="styles">
      <Reveal>
        <p className="eyebrow">Styles</p>
        <h2 className="section-title">Three looks. Same honest number.</h2>
        <p className="section-lead">Pick the one you can live with all day. Every style shows every state.</p>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="styles-stage" data-style={theme} ref={ref}>
          <div className="styles-controls">
            <Segmented name="style" label="Pill style" value={theme} options={THEMES.map((t) => ({ id: t.id, label: t.name }))} onPick={setTheme} />
            <Segmented name="state" label="Pill state" value={stateId} options={(Object.keys(STATES) as StateId[]).map((id) => ({ id, label: STATES[id].label }))} onPick={pickState} />
          </div>
          <div className="styles-pill-spot">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${theme}-${stateId}`}
                initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <DemoPill theme={theme} model={model} className="styles-pill" />
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="styles-blurb"><strong>{current.name}.</strong> {current.blurb}</p>
        </div>
      </Reveal>
    </section>
  );
}
