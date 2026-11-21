-- Planned breaks, taken from the pill's right-click menu. end_ms is the planned end; ending a
-- break early (or starting work) moves it to that moment. A break is running while
-- start_ms <= now < end_ms, so a restart mid-break picks it up from here.
CREATE TABLE breaks (
  id       INTEGER PRIMARY KEY,
  start_ms INTEGER NOT NULL,
  end_ms   INTEGER NOT NULL
);
CREATE INDEX breaks_start ON breaks(start_ms);
