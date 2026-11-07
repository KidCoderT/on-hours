// 16×16 icons. Decorative: the button around each one carries the aria-label.

export const PlayIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16">
    <path d="M5.2 3.55c0-.5.54-.81.97-.55l6.05 4.43a.65.65 0 0 1 0 1.14L6.17 13c-.43.26-.97-.05-.97-.55V3.55Z" fill="currentColor" />
  </svg>
);

export const PauseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16">
    <rect x="4.6" y="3.5" width="2" height="9" rx="1" fill="currentColor" />
    <rect x="9.4" y="3.5" width="2" height="9" rx="1" fill="currentColor" />
  </svg>
);

export const SlidersIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
    <path d="M2.8 5.4h10.4M2.8 10.6h10.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    <path d="M6.6 3.9v3M10.2 9.1v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const ChevronLeftIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
);

export const ChevronRightIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
);
