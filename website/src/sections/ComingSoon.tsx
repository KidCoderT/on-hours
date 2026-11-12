import dots from "../data/world-dots.json";
import { Reveal } from "../ui/Reveal";

// Preview only: a few cities lit on the map. Each snaps to the nearest land dot.
const CITIES: [number, number][] = [[77.6, 13], [0, 51.5], [-74, 40.7], [-122, 37.8], [-46.6, -23.5], [13.4, 52.5], [139.7, 35.7], [151, -33.9], [3.4, 6.5], [55.3, 25.2], [103.8, 1.4], [-99, 19.4]];
const land = dots as [number, number][];
const LIT = CITIES.map(([lon, lat]) => land.reduce((best, d) => (Math.hypot(d[0] - lon, d[1] - lat) < Math.hypot(best[0] - lon, best[1] - lat) ? d : best)));
const x = (lon: number) => lon + 180;
const y = (lat: number) => 90 - lat;

const BOARD: [string, string, number][] = [["Anonymous", "9h 12m", 100], ["mira", "8h 40m", 94], ["Anonymous", "7h 55m", 86], ["dk", "7h 31m", 82], ["Anonymous", "6h 48m", 74]];

export function ComingSoon() {
  return (
    <section className="section wrap" id="soon">
      <Reveal>
        <p className="eyebrow">Coming soon</p>
        <h2 className="section-title">Work alone. Together.</h2>
        <p className="section-lead">Two things are on the way. Both will be opt-in and anonymous.</p>
      </Reveal>
      <div className="soon-grid">
        <Reveal className="soon-panel" delay={0.05}>
          <span className="tag">Coming soon</span>
          <svg className="soon-map" viewBox="8 8 344 140" role="img" aria-label="A dotted world map with a few places lit up">
            {land.map(([lon, lat], i) => <circle key={i} cx={x(lon)} cy={y(lat)} r="0.85" />)}
            {LIT.map(([lon, lat], i) => (
              <g key={i} className="soon-lit" style={{ animationDelay: `${(i * 0.7) % 4}s` }}>
                <circle className="soon-ring" cx={x(lon)} cy={y(lat)} r="1.2" style={{ animationDelay: `${(i * 0.7) % 4}s` }} />
                <circle cx={x(lon)} cy={y(lat)} r="1.5" />
              </g>
            ))}
          </svg>
          <h3>Live map</h3>
          <p>See where in the world people are working right now.</p>
        </Reveal>
        <Reveal className="soon-panel" delay={0.15}>
          <span className="tag">Coming soon</span>
          <ol className="soon-board" aria-hidden="true">
            {BOARD.map(([name, time, pct], i) => (
              <li key={i}>
                <span className="soon-rank">{i + 1}</span>
                <span className="soon-name">{name}</span>
                <span className="soon-meter"><i style={{ width: `${pct}%` }} /></span>
                <span className="soon-time">{time}</span>
              </li>
            ))}
          </ol>
          <h3>Leaderboard</h3>
          <p>Today's longest hours, for the days you need someone to chase.</p>
        </Reveal>
      </div>
      <Reveal>
        <p className="soon-note">Already installed? They arrive by themselves. On Hours updates automatically.</p>
      </Reveal>
    </section>
  );
}
