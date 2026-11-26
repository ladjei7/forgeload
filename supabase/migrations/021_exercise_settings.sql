-- 021_exercise_settings.sql
-- A person's own settings per exercise: the weight step the progression engine uses and the default rest.
-- exercise_key = the library exercise id, or 'name:' + the lower-cased name for custom/legacy exercises.
-- Missing rows mean "use the defaults"; the app works even before this table exists.
-- Rollback: drop table public.exercise_settings;
create table if not exists public.exercise_settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_key text not null check (char_length(exercise_key) between 1 and 200),
  weight_step_lb numeric(6,2) check (weight_step_lb is null or (weight_step_lb > 0 and weight_step_lb <= 100)),
  rest_seconds smallint check (rest_seconds is null or rest_seconds between 15 and 900),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_key)
);
alter table public.exercise_settings enable row level security;
drop policy if exists "own rows" on public.exercise_settings;
create policy "own rows" on public.exercise_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
