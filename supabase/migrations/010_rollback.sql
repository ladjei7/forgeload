-- 010_rollback.sql
-- NOT RUN. Only for use with explicit owner approval if 010 causes a problem.
-- Restores the exact pre-010 policies (captured 2026-11-04T21:17Z) and removes what 010 added.
--
-- Data safety: steps 1 and 2 touch no rows. Step 3 drops the new columns, which deletes any values
-- people entered into them after 010. Before running step 3, check that nothing would be lost:
--   select count(*) from public.exercise_sets where set_type <> 'working' or rir is not null or rpe is not null or skipped;
-- If that is not 0, skip step 3 (the columns are harmless to keep).

begin;

-- 1. Policies back to exactly what they were.
alter policy "own rows" on public.workout_plans   using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "own rows" on public.workout_days    using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "own rows" on public.plan_exercises  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "own rows" on public.workout_sessions using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "own rows" on public.exercise_logs   using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "own rows" on public.exercise_sets   using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Indexes (performance only; no data).
drop index if exists public.exercise_logs_session_idx, public.exercise_logs_user_idx, public.exercise_sets_log_idx,
  public.exercise_sets_user_idx, public.plan_exercises_day_idx, public.plan_exercises_user_idx, public.workout_days_plan_idx,
  public.workout_days_user_idx, public.workout_plans_user_idx, public.workout_sessions_day_idx, public.exercises_user_idx,
  public.user_exercise_prefs_exercise_idx;

-- 3. New columns. READ THE NOTE ABOVE FIRST.
-- alter table public.exercise_sets drop column if exists set_type, drop column if exists rir, drop column if exists rpe, drop column if exists skipped;

commit;
