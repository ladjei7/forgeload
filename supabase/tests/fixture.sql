-- LOCAL TEST FIXTURE ONLY. Mimics the parts of Supabase and the existing ForgeLoad schema
-- that the migrations touch, using made-up sample exercises. Never run against production.
create schema if not exists auth;
create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table exercises (id uuid primary key default gen_random_uuid(), name text not null,
  muscle_group text, equipment text, user_id uuid default auth.uid());
create table workout_plans (id uuid primary key default gen_random_uuid(), name text, user_id uuid default auth.uid());
create table workout_days (id uuid primary key default gen_random_uuid(), plan_id uuid references workout_plans on delete cascade,
  day_name text, sort_order int, user_id uuid default auth.uid());
create table plan_exercises (id uuid primary key default gen_random_uuid(), workout_day_id uuid references workout_days on delete cascade,
  exercise_name text, target_sets int, rep_min int, rep_max int, sort_order int, user_id uuid default auth.uid());
create table workout_sessions (id uuid primary key default gen_random_uuid(), workout_day_id uuid, session_date date,
  user_id uuid default auth.uid());
create table exercise_logs (id uuid primary key default gen_random_uuid(), workout_session_id uuid references workout_sessions on delete cascade,
  exercise_name text, user_id uuid default auth.uid());

alter table exercises enable row level security;
create policy "read builtin or own" on exercises for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "write own" on exercises for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Deliberately WEAK extra policy, to prove the migration's restrictive policies close it:
create policy "weak: anyone can edit builtin" on exercises for update to authenticated using (user_id is null);

alter table plan_exercises enable row level security;
create policy "own rows" on plan_exercises for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table exercise_logs enable row level security;
create policy "own rows" on exercise_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table workout_sessions enable row level security;
create policy "own rows" on workout_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema public, extensions to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Made-up sample catalog (NOT real library data), incl. a typo name like the one in the real app.
insert into exercises (name, muscle_group, equipment, user_id) values
 ('Barbell Bench Press','Chest','Barbell',null), ('Incline Dumbbell Press','Chest','Dumbbell',null),
 ('Incline Machine Press','Chest','Machine',null), ('Cable Fly','Chest','Cable',null),
 ('Romanian Deadlift','Hamstrings','Barbell',null), ('Dumbbell Romanian Deadlift','Hamstrings','Dumbbell',null),
 ('Lat Pulldown','Back','Cable',null), ('Close Grip Lat Pulldown','Back','Cable',null),
 ('Cable Curl','Biceps','Cable',null), ('Dumbbell Curl','Biceps','Dumbbell',null),
 ('Barbell Back Squat','Quads','Barbell',null), ('Overhead Press','Shoulders','Barbell',null),
 ('Pendulum Squat','Quads','Machine',null), ('Reverse Barbell Curl','Biceps','Barbell',null),
 ('Tricep Pushdown','Triceps','Cable',null), ('Leg Press','Quads','Machine',null);
