-- The goal each day was judged against, keyed by the work-day's start. Written while the app runs,
-- so changing the goal later never rejudges the past. A day without a row (before this existed)
-- falls back to the current goal.
CREATE TABLE day_goal (
  day_ms  INTEGER PRIMARY KEY,
  goal_ms INTEGER NOT NULL
);
