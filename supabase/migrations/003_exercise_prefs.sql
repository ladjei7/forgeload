-- 003_exercise_prefs.sql
-- Purpose: favorites and recently used exercises, plus filter options for the library.
--
-- Safe: ADDITIVE only (one new table, four new functions). Nothing existing is changed.
-- Run ONCE in the Supabase SQL Editor, after 002. The old app keeps working afterward.
-- Each user can only see and change their own favorites and recents (row-level security).

begin;

do $$
declare idtype text;
begin
  select data_type into idtype from information_schema.columns
   where table_schema = 'public' and table_name = 'exercises' and column_name = 'id';
  if idtype is null then raise exception 'exercises.id not found'; end if;
  execute format($f$
    create table if not exists user_exercise_prefs (
      user_id uuid not null default auth.uid(),
      exercise_id %s not null references exercises(id) on delete cascade,
      is_favorite boolean not null default false,
      last_used_at timestamptz,
      primary key (user_id, exercise_id)
    )$f$, idtype);
end $$;

alter table user_exercise_prefs enable row level security;
drop policy if exists "own prefs" on user_exercise_prefs;
create policy "own prefs" on user_exercise_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on user_exercise_prefs to authenticated;

-- Mark an exercise as just used (recents). Idempotent.
create or replace function public.touch_exercise(ex user_exercise_prefs.exercise_id%type)
returns void language sql security invoker as $$
  insert into user_exercise_prefs (exercise_id, last_used_at) values (ex, now())
  on conflict (user_id, exercise_id) do update set last_used_at = now();
$$;

-- Star or unstar an exercise. Idempotent.
create or replace function public.set_favorite(ex user_exercise_prefs.exercise_id%type, fav boolean)
returns void language sql security invoker as $$
  insert into user_exercise_prefs (exercise_id, is_favorite) values (ex, fav)
  on conflict (user_id, exercise_id) do update set is_favorite = fav;
$$;

-- The caller's favorites or recents. Capped at 30 rows.
create or replace function public.my_exercises(kind text default 'recent', lim integer default 15)
returns table (
  id exercises.id%type, name text, muscle_group text, equipment text,
  tracking_type text, load_convention text, is_custom boolean, is_favorite boolean)
language sql stable security invoker
as $$
  select e.id, e.name, e.muscle_group, e.equipment, e.tracking_type, e.load_convention,
         (e.user_id is not null), p.is_favorite
    from user_exercise_prefs p
    join exercises e on e.id = p.exercise_id
   where p.user_id = auth.uid()
     and e.archived_at is null
     and ((kind = 'favorite' and p.is_favorite) or (kind = 'recent' and p.last_used_at is not null))
   order by case when kind = 'recent' then p.last_used_at end desc nulls last, e.name
   limit least(greatest(coalesce(lim, 15), 1), 30)
$$;

-- Filter options for the library: the muscle groups and equipment the caller can see.
create or replace function public.exercise_facets()
returns table (kind text, value text, n bigint)
language sql stable security invoker
as $$
  select 'muscle', muscle_group, count(*) from exercises
   where archived_at is null and muscle_group is not null group by muscle_group
  union all
  select 'equipment', equipment, count(*) from exercises
   where archived_at is null and equipment is not null group by equipment
$$;

revoke all on function public.touch_exercise(user_exercise_prefs.exercise_id%type) from public, anon;
revoke all on function public.set_favorite(user_exercise_prefs.exercise_id%type, boolean) from public, anon;
revoke all on function public.my_exercises(text, integer) from public, anon;
revoke all on function public.exercise_facets() from public, anon;
grant execute on function public.touch_exercise(user_exercise_prefs.exercise_id%type) to authenticated;
grant execute on function public.set_favorite(user_exercise_prefs.exercise_id%type, boolean) to authenticated;
grant execute on function public.my_exercises(text, integer) to authenticated;
grant execute on function public.exercise_facets() to authenticated;

commit;

-- ROLLBACK (loses favorites and recents only; plans and logs are unaffected):
-- drop function if exists public.exercise_facets();
-- drop function if exists public.my_exercises(text, integer);
-- drop function if exists public.set_favorite(user_exercise_prefs.exercise_id%type, boolean);
-- drop function if exists public.touch_exercise(user_exercise_prefs.exercise_id%type);
-- drop table if exists user_exercise_prefs;
