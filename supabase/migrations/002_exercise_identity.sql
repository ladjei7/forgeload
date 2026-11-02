-- 002_exercise_identity.sql
-- Purpose: give every exercise a stable identity and a database-side search, so the
-- library can grow to 700-1,000+ entries without breaking history.
--
-- Safe: ADDITIVE only. Nothing is dropped, renamed or deleted. Existing exercise ids,
-- names, plans and logged workouts are untouched. exercise_name stays on plans and logs
-- as the readable snapshot; exercise_id is added NEXT to it.
-- Run ONCE in the Supabase SQL Editor, after 001. The old app keeps working afterward.
-- Contains no third-party exercise data (that is imported separately, never committed).

begin;

create extension if not exists pg_trgm with schema extensions;

-- 1. Canonical fields on exercises (all optional or defaulted) ------------------------
alter table exercises
  add column if not exists aliases text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists movement_pattern text,
  add column if not exists category text,
  add column if not exists mechanic text,             -- compound | isolation
  add column if not exists level text,                -- beginner | intermediate | advanced
  add column if not exists is_unilateral boolean not null default false,
  add column if not exists tracking_type text not null default 'weight_reps'
    check (tracking_type in ('weight_reps','bodyweight_reps','added_weight_reps','assisted_reps',
                             'duration','weight_duration','distance_duration')),
  add column if not exists load_convention text not null default 'total'
    check (load_convention in ('total','per_hand','per_side','per_implement')),
  add column if not exists instructions text,
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_version text,
  add column if not exists review_status text not null default 'legacy',
  add column if not exists plan_eligible boolean not null default false,
  add column if not exists archived_at timestamptz;

-- 2. exercise_id next to exercise_name (type copied from exercises.id) -----------------
do $$
declare idtype text;
begin
  select data_type into idtype from information_schema.columns
   where table_schema = 'public' and table_name = 'exercises' and column_name = 'id';
  if idtype is null then raise exception 'exercises.id not found'; end if;
  execute format('alter table plan_exercises add column if not exists exercise_id %s references exercises(id) on delete set null', idtype);
  execute format('alter table exercise_logs  add column if not exists exercise_id %s references exercises(id) on delete set null', idtype);
end $$;

create index if not exists plan_exercises_exercise_id_idx on plan_exercises (exercise_id);
create index if not exists exercise_logs_exercise_id_idx  on exercise_logs  (exercise_id);

-- 3. Backfill: link a row ONLY when exactly one visible exercise has that exact name --
--    (case and surrounding spaces ignored). Ambiguous or unmatched rows stay NULL for
--    review; nothing is guessed. exercise_name is never modified.
update plan_exercises pe
   set exercise_id = m.exercise_id
  from (
    select p.id as row_id, (array_agg(e.id))[1] as exercise_id, count(*) as c
      from plan_exercises p
      join exercises e
        on lower(btrim(e.name)) = lower(btrim(p.exercise_name))
       and (e.user_id is null or e.user_id = p.user_id)
     where p.exercise_id is null
     group by p.id
  ) m
 where pe.id = m.row_id and m.c = 1;

update exercise_logs el
   set exercise_id = m.exercise_id
  from (
    select l.id as row_id, (array_agg(e.id))[1] as exercise_id, count(*) as c
      from exercise_logs l
      join exercises e
        on lower(btrim(e.name)) = lower(btrim(l.exercise_name))
       and (e.user_id is null or e.user_id = l.user_id)
     where l.exercise_id is null
     group by l.id
  ) m
 where el.id = m.row_id and m.c = 1;

-- 4. Search abbreviations (ours, not licensed data) -----------------------------------
create table if not exists search_abbreviations (
  abbr text primary key,
  expansion text not null
);
alter table search_abbreviations enable row level security;
drop policy if exists "read abbreviations" on search_abbreviations;
create policy "read abbreviations" on search_abbreviations for select to authenticated using (true);
grant select on search_abbreviations to authenticated;

insert into search_abbreviations (abbr, expansion) values
  ('rdl','romanian deadlift'), ('sldl','stiff leg deadlift'), ('ohp','overhead press'),
  ('db','dumbbell'), ('bb','barbell'), ('kb','kettlebell'), ('ez','ez bar'),
  ('bw','bodyweight'), ('sm','smith machine'), ('dl','deadlift'), ('bp','bench press'),
  ('cgbp','close grip bench press'), ('tri','tricep'), ('bi','bicep'), ('rear','rear delt'),
  ('ghr','glute ham raise'), ('pullup','pull up'), ('chinup','chin up')
on conflict (abbr) do nothing;

-- 5. Search: typo-tolerant, alias-aware, ranked; runs with the CALLER's permissions (RLS) -
--    Results are capped at 50 per call. There is deliberately no "export everything" call.
create index if not exists exercises_name_trgm_idx
  on exercises using gin (lower(name) extensions.gin_trgm_ops);

create or replace function public.search_exercises(
  q text default '', muscle text default null, equip text default null,
  lim integer default 30, off integer default 0)
returns table (
  id exercises.id%type, name text, muscle_group text, equipment text,
  tracking_type text, load_convention text, is_custom boolean, rank real)
language sql stable security invoker
set search_path = public, extensions
as $$
  with params as (
    select least(greatest(coalesce(lim, 30), 1), 50) as l,
           greatest(coalesce(off, 0), 0) as o,
           lower(btrim(regexp_replace(coalesce(q, ''), '[^a-zA-Z0-9]+', ' ', 'g'))) as nq
  ),
  words as (
    select distinct
      case when length(x.w) > 3 and x.w like '%s' and x.w not like '%ss'
           then left(x.w, length(x.w) - 1) else x.w end as w
    from params p
    cross join lateral regexp_split_to_table(p.nq, ' ') t(tok)
    left join search_abbreviations sa on sa.abbr = t.tok
    cross join lateral regexp_split_to_table(coalesce(sa.expansion, t.tok), ' ') x(w)
    where t.tok <> '' and x.w <> ''
  ),
  cand as (
    select e.id, e.name, e.muscle_group, e.equipment, e.tracking_type, e.load_convention, e.user_id,
           lower(e.name) as lname,
           lower(e.name || ' ' || coalesce(array_to_string(e.aliases, ' '), '') || ' '
                 || coalesce(e.muscle_group, '') || ' ' || coalesce(e.equipment, '')) as hay
      from exercises e
     where e.archived_at is null
       and (muscle is null or lower(e.muscle_group) = lower(muscle))
       and (equip  is null or lower(e.equipment)    = lower(equip))
  )
  select c.id, c.name, c.muscle_group, c.equipment, c.tracking_type, c.load_convention,
         (c.user_id is not null) as is_custom,
         (  case when c.lname = (select nq from params) then 100 else 0 end
          + case when c.lname like (select nq from params) || '%' then 20 else 0 end
          + (select coalesce(avg(word_similarity(w.w, c.lname)), 0) from words w) * 10
          + similarity(c.lname, (select nq from params)) * 10)::real as rank
    from cand c
   where not exists (
           select 1 from words w
            where not (c.hay like '%' || w.w || '%' or word_similarity(w.w, c.hay) >= case when length(w.w) >= 7 then 0.5 else 0.7 end))
   order by rank desc, c.name
   limit (select l from params) offset (select o from params)
$$;

revoke all on function public.search_exercises(text, text, text, integer, integer) from public, anon;
grant execute on function public.search_exercises(text, text, text, integer, integer) to authenticated;

-- 6. Built-in exercises can never be edited or deleted by users ------------------------
--    RESTRICTIVE policies are ANDed with whatever policies already exist, so this only
--    tightens. Users may still create, edit, archive and delete their OWN exercises.
drop policy if exists exercises_own_rows_only_insert on exercises;
drop policy if exists exercises_own_rows_only_update on exercises;
drop policy if exists exercises_own_rows_only_delete on exercises;
create policy exercises_own_rows_only_insert on exercises as restrictive for insert to authenticated
  with check (user_id = auth.uid());
create policy exercises_own_rows_only_update on exercises as restrictive for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercises_own_rows_only_delete on exercises as restrictive for delete to authenticated
  using (user_id = auth.uid());

commit;

-- ROLLBACK (removes the new structure; logged workouts and plans are not affected because
-- exercise_name is still on every row):
-- drop function if exists public.search_exercises(text, text, text, integer, integer);
-- drop policy if exists exercises_own_rows_only_insert on exercises;
-- drop policy if exists exercises_own_rows_only_update on exercises;
-- drop policy if exists exercises_own_rows_only_delete on exercises;
-- drop table if exists search_abbreviations;
-- drop index if exists exercises_name_trgm_idx, plan_exercises_exercise_id_idx, exercise_logs_exercise_id_idx;
-- alter table plan_exercises drop column if exists exercise_id;
-- alter table exercise_logs  drop column if exists exercise_id;
-- (new exercises columns can stay; they are harmless)
