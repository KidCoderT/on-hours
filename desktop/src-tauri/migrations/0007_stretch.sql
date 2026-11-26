-- Extra time added to one day's goal: "Goal met. Push 30 more minutes?" Keyed by the work-day's
-- start, so the next day starts from the normal goal. The day still counts as kept at the normal
-- goal; the extra is a bonus round, and missing it never fails the day.
CREATE TABLE day_extra (
  day_ms   INTEGER PRIMARY KEY,
  extra_ms INTEGER NOT NULL
);
