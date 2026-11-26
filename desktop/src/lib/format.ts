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

/** Local date and time, sortable: 2026-11-04 09:30 */
const stamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${fmtTime(ms)}`;
};

/** Finished sessions as CSV: one row each, local times, whole minutes. Opens in Excel. */
export const sessionsCsv = (sessions: { start_ms: number; end_ms: number }[]) =>
  ["start,end,minutes", ...sessions.map((s) => `${stamp(s.start_ms)},${stamp(s.end_ms)},${Math.round((s.end_ms - s.start_ms) / 60_000)}`)].join("\r\n") + "\r\n";

export const fmtDate =(d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

/** Short duration, hours:minutes rounded to the minute, sign dropped: 4:05. Used by pill themes. */
export const fmtHMM = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60_000);
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
};
