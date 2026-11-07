const pad = (n: number) => String(n).padStart(2, "0");

/** Pill clock: 1:05:09 */
export const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** Chart totals: 1h 05m */
export const fmtHM = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};

export const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);
