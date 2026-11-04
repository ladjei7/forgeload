-- 010_set_details_and_rls_perf.sql
-- DRAFT. NOT APPLIED. Needs your approval before it runs on the live database.
-- Additive only: no column is removed, no row is changed except defaults on new columns.
-- Rollback notes at the bottom.

begin;

-- 1. Set details (spec section 13.1). Existing rows become 'working', which is what they are.
alter table public.exercise_sets
  add column if not exists set_type text not null default 'working'
    check (set_type in ('working', 'warmup', 'drop', 'failure')),
  add column if not exists rir smallint check (rir between 0 and 10),
  add column if not exists rpe numeric(3,1) check (rpe between 1 and 10),
  add column if not exists skipped boolean not null default false;

-- 2. Indexes for foreign keys flagged by the performance advisor.
create index if not exists exercise_logs_session_idx on public.exercise_logs (workout_session_id);
create index if not exists exercise_logs_user_idx on public.exercise_logs (user_id);
create index if not exists exercise_sets_log_idx on public.exercise_sets (exercise_log_id);
create index if not exists exercise_sets_user_idx on public.exercise_sets (user_id);
create index if not exists plan_exercises_day_idx on public.plan_exercises (workout_day_id);
create index if not exists plan_exercises_user_idx on public.plan_exercises (user_id);
create index if not exists workout_days_plan_idx on public.workout_days (plan_id);
create index if not exists workout_days_user_idx on public.workout_days (user_id);
create index if not exists workout_plans_user_idx on public.workout_plans (user_id);
create index if not exists workout_sessions_day_idx on public.workout_sessions (workout_day_id);
create index if not exists exercises_user_idx on public.exercises (user_id);
create index if not exists user_exercise_prefs_exercise_idx on public.user_exercise_prefs (exercise_id);

-- 3. RLS: evaluate auth.uid() once per query instead of per row (same rule, faster).
--    Also check that a child row's parent belongs to the same user (audit finding 4).
alter policy "own rows" on public.workout_plans using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "own rows" on public.workout_days using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = (select auth.uid())));
alter policy "own rows" on public.plan_exercises using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workout_days d where d.id = workout_day_id and d.user_id = (select auth.uid())));
alter policy "own rows" on public.workout_sessions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "own rows" on public.exercise_logs using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workout_sessions s where s.id = workout_session_id and s.user_id = (select auth.uid())));
alter policy "own rows" on public.exercise_sets using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.exercise_logs l where l.id = exercise_log_id and l.user_id = (select auth.uid())));

commit;

-- Verify after applying: run supabase/diagnostics/rls_isolation_test.sql (expect all zeros) and the security advisor.
-- Rollback: the new columns and indexes can be dropped without data loss for older rows
-- (alter table public.exercise_sets drop column set_type, drop column rir, drop column rpe, drop column skipped;)
-- and the policies can be restored to `auth.uid() = user_id` without the parent checks.
