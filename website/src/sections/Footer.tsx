import { REPO, type Release } from "../lib/release";
import { DownloadButton } from "../ui/DownloadButton";
import { Reveal } from "../ui/Reveal";
import { Logo } from "./Header";

const YEAR = new Date().getFullYear();

/** The closing statement (free, open source) and the footer links. */
export function Footer({ release }: { release: Release }) {
  return (
    <>
      <section className="section wrap free">
        <Reveal>
          <p className="eyebrow">Price</p>
          <h2 className="free-title">Free. No account. No tracking.</h2>
          <p className="section-lead">On Hours is open source and your hours never leave your computer.</p>
          <div className="hero-actions">
            <DownloadButton release={release} />
            <a className="btn btn-quiet" href={REPO} target="_blank" rel="noreferrer">Read the code</a>
          </div>
        </Reveal>
      </section>
      <footer className="site-footer">
        <div className="wrap site-footer-row">
          <span className="brand"><Logo /><span>On Hours</span></span>
          <nav aria-label="Project links">
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
            <a href={`${REPO}/releases`} target="_blank" rel="noreferrer">Releases</a>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Report a problem</a>
          </nav>
          <span className="site-footer-meta">{release.version ?? ""} © {YEAR}</span>
        </div>
      </footer>
    </>
  );
}
