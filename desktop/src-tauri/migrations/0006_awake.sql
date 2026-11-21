-- When the PC was on and awake with On Hours open: one row per stretch, extended every 30s by the
-- pill. A gap longer than 2 minutes (sleep, shutdown, the app closed) starts a new row.
CREATE TABLE awake (
  id       INTEGER PRIMARY KEY,
  start_ms INTEGER NOT NULL,
  end_ms   INTEGER NOT NULL
);
CREATE INDEX awake_start ON awake(start_ms);
