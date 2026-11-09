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

/** Clock time of a timestamp, 24h: 09:30 */
export const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtDate =(d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

/** Short duration, hours:minutes rounded to the minute, sign dropped: 4:05. Used by pill themes. */
export const fmtHMM = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60_000);
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
};
