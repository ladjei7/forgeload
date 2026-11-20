-- 013_session_day_ownership.sql
-- A workout session may only point at one of the user's own workouts (or at none, e.g. after that
-- workout was removed from a plan). Before this, the check only required the session row itself to be
-- the user's. No data could be read across accounts either way; this closes the reference gap.
-- Policy change only. No row is changed or deleted. Existing rows were checked first (0 violations).

alter policy "own rows" on public.workout_sessions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (workout_day_id is null
         or exists (select 1 from public.workout_days d where d.id = workout_day_id and d.user_id = (select auth.uid()))));

-- Rollback (only with approval):
--   alter policy "own rows" on public.workout_sessions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
