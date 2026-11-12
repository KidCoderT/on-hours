import { REPO, type Release } from "../lib/release";
import { DownloadButton } from "../ui/DownloadButton";
import { Reveal } from "../ui/Reveal";
import { Logo } from "./Header";

/** A drawing of the Windows SmartScreen dialog, so the two clicks are easy to recognise. */
function SmartScreen({ step }: { step: 1 | 2 }) {
  return (
    <div className="smartscreen" aria-hidden="true">
      <strong>Windows protected your PC</strong>
      <p>Microsoft Defender SmartScreen prevented an unrecognised app from starting.</p>
      {step === 1 ? (
        <span className="smartscreen-link" data-pick="true">More info</span>
      ) : (
        <p className="smartscreen-app">App: On Hours_x64-setup.exe<br />Publisher: Unknown publisher</p>
      )}
      <div className="smartscreen-buttons">
        {step === 2 && <span className="smartscreen-btn" data-pick="true">Run anyway</span>}
        <span className="smartscreen-btn">Don't run</span>
      </div>
    </div>
  );
}

const Tray = () => (
  <div className="tray" aria-hidden="true">
    <ul>
      <li>Start / Pause</li>
      <li>Show pill</li>
      <li>Settings</li>
      <li className="tray-rule">Quit On Hours</li>
    </ul>
    <div className="tray-bar"><span>⌃</span><Logo /><span className="tray-clock">15:04</span></div>
  </div>
);

export function Download({ release }: { release: Release }) {
  return (
    <section className="section wrap" id="download">
      <Reveal>
        <p className="eyebrow">Download</p>
        <h2 className="section-title">Installed in a minute.</h2>
        <p className="section-lead">Windows 10 and 11. Mac and Linux are not available yet.</p>
      </Reveal>
      <ol className="steps">
        <Reveal as="li" className="step">
          <div className="step-copy">
            <span className="step-num">1</span>
            <h3>Download the installer</h3>
            <p>One small file, about 4 MB. It comes straight from the project's GitHub releases.</p>
            <DownloadButton release={release} />
          </div>
          <div className="step-art">
            <div className="file-chip"><Logo /><span>On Hours_x64-setup.exe<small>{release.version ?? "Latest version"} · 4 MB</small></span></div>
          </div>
        </Reveal>
        <Reveal as="li" className="step">
          <div className="step-copy">
            <span className="step-num">2</span>
            <h3>Run it, and tell Windows it's fine</h3>
            <p>
              Windows shows a blue warning because On Hours is new and not yet code-signed. Click <b>More info</b>,
              then <b>Run anyway</b>.
            </p>
            <p className="step-note">
              Signing costs a yearly fee, so it comes later. Until then, the code is open for anyone to read
              on <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>.
            </p>
          </div>
          <div className="step-art step-art-pair">
            <SmartScreen step={1} />
            <SmartScreen step={2} />
          </div>
        </Reveal>
        <Reveal as="li" className="step">
          <div className="step-copy">
            <span className="step-num">3</span>
            <h3>Find the pill</h3>
            <p>
              It appears on your screen, on top of everything. Drag it wherever you like. The tray icon sits by the
              clock, sometimes under the small arrow.
            </p>
          </div>
          <div className="step-art"><Tray /></div>
        </Reveal>
        <Reveal as="li" className="step">
          <div className="step-copy">
            <span className="step-num">4</span>
            <h3>Never update by hand</h3>
            <p>New versions download in the background and install while the timer is paused. A running session is never interrupted.</p>
          </div>
          <div className="step-art">
            <div className="update-chip"><span>v0.1.0</span><i /><span data-new="true">Up to date</span></div>
          </div>
        </Reveal>
      </ol>
    </section>
  );
}
