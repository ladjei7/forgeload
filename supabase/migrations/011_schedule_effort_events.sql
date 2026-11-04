-- 011_schedule_effort_events.sql
-- DRAFT. NOT APPLIED. Run on forgeload-dev first, then production only with explicit approval.
-- Additive only: new tables, new nullable columns, a widened check constraint. No row is changed or deleted.

begin;

-- 1. Optional weekly schedule (one per plan). Templates, rotation, schedule and history stay separate:
--    this table only says which weekday a workout day is planned for. Sessions never reference it,
--    so changing a schedule can never rewrite history.
create table if not exists public.plan_schedules (
  plan_id uuid primary key references public.workout_plans(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode text not null default 'rotation' check (mode in ('rotation', 'weekly')),
  week_start smallint not null default 0 check (week_start between 0 and 6),   -- 0 = Monday
  slots jsonb not null default '[]'::jsonb,                                     -- [{weekday, dayId}]
  since date not null default current_date,                                     -- nothing earlier can be "missed"
  updated_at timestamptz not null default now()
);

-- 2. The user's explicit answers to schedule prompts. Never inferred. Unique per occurrence, so a prompt
--    can be answered once and is not shown again.
create table if not exists public.schedule_decisions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  occurrence_date date not null,
  workout_day_id uuid not null references public.workout_days(id) on delete cascade,
  action text not null check (action in ('skipped', 'rescheduled', 'dismissed', 'did_today_instead')),
  rescheduled_to date,
  created_at timestamptz not null default now(),
  unique (plan_id, occurrence_date, workout_day_id)
);

-- 3. Effort. Plain-language effort is per exercise and is NOT the same thing as RIR (stored per set in 010).
alter table public.exercise_logs
  add column if not exists effort text check (effort in ('easy', 'manageable', 'very_hard', 'unsure'));
alter table public.user_training_prefs
  add column if not exists track_rir boolean not null default false,
  add column if not exists ask_effort boolean not null default true;

-- 4. Alpha product events (privacy-light: no notes, no free text, no weights).
alter table public.user_events drop constraint if exists user_events_kind_check;
alter table public.user_events add constraint user_events_kind_check check (kind in (
  'swap', 'skip', 'feel', 'suggestion',
  'onboarding_completed', 'plan_created', 'workout_started', 'workout_completed', 'sync_failed', 'schedule_prompt'));

-- RLS: owner only, same pattern as the rest of the schema.
alter table public.plan_schedules enable row level security;
alter table public.schedule_decisions enable row level security;
create policy "own rows" on public.plan_schedules for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy "own rows" on public.schedule_decisions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create index if not exists schedule_decisions_user_idx on public.schedule_decisions (user_id);
create index if not exists plan_schedules_user_idx on public.plan_schedules (user_id);

commit;

-- Rollback (only with approval): drop the two new tables, drop the three new columns (check they are empty
-- first), and restore the user_events check to ('swap','skip','feel','suggestion') after confirming no rows
-- use the new kinds.
