import { useEffect, useState } from "react";
import { REPO, type Release } from "../lib/release";
import { ModeToggle } from "../ui/ModeToggle";

export const Logo = () => (
  <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#1c1f22" />
    <path d="M41.75 20.07A17 17 0 1 1 22.25 20.07" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    <path d="M32 34L41 39" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    <path d="M32 34V12" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export function Header({ release }: { release: Release }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="wrap site-header-row">
        <a className="brand" href="#top">
          <Logo />
          <span>On Hours</span>
        </a>
        <nav className="site-nav" aria-label="Sections">
          <a href="#idea">How it works</a>
          <a href="#styles">Styles</a>
          <a href="#settings">Settings</a>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="site-header-end">
          <ModeToggle />
          <a className="btn btn-small" href="#download">
            Download{release.version ? <span className="btn-version">{release.version}</span> : null}
          </a>
        </div>
      </div>
    </header>
  );
}
