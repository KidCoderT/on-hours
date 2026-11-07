-- Work sessions. Times are unix milliseconds (date + time of day).
-- Today's timer is not stored separately: it is derived from these rows.
CREATE TABLE sessions (
  id       INTEGER PRIMARY KEY,
  start_ms INTEGER NOT NULL,           -- when play was pressed
  end_ms   INTEGER NOT NULL,           -- last heartbeat while running; final end once paused
  open     INTEGER NOT NULL DEFAULT 1  -- 1 = running right now
);
CREATE INDEX sessions_start ON sessions(start_ms);
-- The database itself refuses a second running session.
CREATE UNIQUE INDEX one_open_session ON sessions(open) WHERE open = 1;

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('daily_goal_min', '240'),
  ('day_start', '00:00');
