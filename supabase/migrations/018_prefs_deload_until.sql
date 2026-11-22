-- 018_prefs_deload_until.sql
-- "Also the rest of this week" for deloads, saved to the account instead of one device: the last day
-- (Sunday) the choice covers. Null = no deload week. Workouts started on or before that day (in that
-- week) start as deloads; each workout can still be switched off.
--
-- Additive only: one nullable column. user_training_prefs keeps its existing "own rows" policy
-- (auth.uid() = user_id for every command), which covers the new column.

alter table public.user_training_prefs add column if not exists deload_until date;

-- Rollback (only with approval): alter table public.user_training_prefs drop column if exists deload_until;
