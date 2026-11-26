import { Reveal } from "../ui/Reveal";

const ITEMS: [string, string][] = [
  ["Style", "How the pill looks: Baseline, Instrument or Ledger."],
  ["Appearance", "Light, dark, or follow Windows."],
  ["Settings button", "Show or hide the small button on the pill. Right-click it for breaks and settings either way."],
  ["Show in screen recordings", "Turn it off and the pill disappears from recordings and screen shares."],
  ["Daily goal", "Your minimum hours. The pill turns green when you get there."],
  ["Stretch by", "Goal met while working: offers this much more, just for today. 30 min unless you change it, 0 to never ask."],
  ["Day starts at", "When a new day begins. Useful if you work past midnight."],
  ["Week starts on", "The first column of the history chart."],
  ["Long pause after", "How long a pause can run before the pill turns red and starts asking for you."],
  ["Alarm after", "When the pill grows, shakes and flashes in the taskbar: 1.5 long pauses unless you change it."],
  ["Check in after", "No keyboard or mouse this long while the timer runs: a bubble asks if you're still there. 10 min by default."],
  ["Pause after", "No input this long and the timer pauses at your last input, then asks when you're back. 20 min by default."],
  ["Open at login", "Start On Hours when you sign in to Windows."],
  ["Pause / resume hotkey", "Start or pause from any app without touching the pill. Ctrl + Alt + Shift + O unless you pick your own."],
];

export function Settings() {
  return (
    <section className="section wrap" id="settings">
      <Reveal>
        <p className="eyebrow">Settings</p>
        <h2 className="section-title">Fourteen switches. That's all of them.</h2>
        <p className="section-lead">Right-click the pill and choose Settings, or click the tray icon by the clock.</p>
      </Reveal>
      <div className="settings-layout">
        <Reveal className="settings-shot" delay={0.05}>
          <div className="window-frame">
            <div className="window-frame-bar"><span>Settings</span><i /><i /><i /></div>
{/* Both are in the page; site.css shows the one for the current mode. Lazy, so only that one loads. */}
            <img className="only-light" src="/shots/settings-light.png" width={450} height={SHOT_HEIGHT} alt="The On Hours settings window, showing the Pill, Daily rhythm and System groups." loading="lazy" />
            <img className="only-dark" src="/shots/settings-dark.png" width={450} height={SHOT_HEIGHT} alt="" loading="lazy" />
          </div>
        </Reveal>
        <ol className="settings-list">
          {ITEMS.map(([name, text], i) => (
            <Reveal as="li" key={name} delay={0.04 * i}>
              <h3>{name}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Height of the screenshot at 450 wide; regenerate with `node scripts/shots/site.mjs`.
const SHOT_HEIGHT = 1112;
