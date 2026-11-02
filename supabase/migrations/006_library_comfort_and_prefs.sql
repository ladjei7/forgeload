-- 006_library_comfort_and_prefs.sql   (DRAFT. Not run. Run manually in the Supabase SQL Editor after review.)
-- Purpose: foundation for comfort-aware plan generation and the free suggestion rules.
-- Safe: ADDITIVE only. Nothing dropped, renamed or deleted. Contains no third-party exercise data.
-- All of this is FREE-tier data and belongs to the user. It must never depend on a subscription.
begin;

-- Curated metadata the generator trusts. Imported exercises stay searchable but are not generator-eligible until reviewed.
alter table exercises
  add column if not exists comfort_level smallint check (comfort_level between 1 and 3), -- 1 machine/cable, 2 dumbbell/bodyweight, 3 barbell
  add column if not exists metadata_reviewed boolean not null default false;

create table if not exists user_training_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  comfort text not null default 'unsure' check (comfort in ('machines','mixed','all','unsure')),
  avoid_exercise_ids text[] not null default '{}',
  session_minutes smallint check (session_minutes between 15 and 180),
  updated_at timestamptz not null default now()
);
alter table user_training_prefs enable row level security;
create policy "own prefs select" on user_training_prefs for select using (user_id = auth.uid());
create policy "own prefs insert" on user_training_prefs for insert with check (user_id = auth.uid());
create policy "own prefs update" on user_training_prefs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own prefs delete" on user_training_prefs for delete using (user_id = auth.uid());

-- Append-only behavior log (swap, skip, comfort feedback, suggestion shown/accepted/dismissed). No update or delete policy on purpose.
create table if not exists user_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('swap','skip','feel','suggestion')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists user_events_user_time on user_events (user_id, created_at desc);
alter table user_events enable row level security;
create policy "own events select" on user_events for select using (user_id = auth.uid());
create policy "own events insert" on user_events for insert with check (user_id = auth.uid());

commit;
