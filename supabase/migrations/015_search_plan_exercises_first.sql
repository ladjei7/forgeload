-- 015_search_plan_exercises_first.sql
-- Persona test: "db bench" listed Dumbbell Bench Pull above Dumbbell Bench Press, and the Library
-- opened on 90/90 Hold and Air Bike. The 42 exercises plans use (plan_eligible) are the ones most
-- people mean, so they get a small ranking boost (+3). An exact name match (+100) still wins.
--
-- Same signature, same columns, same security (invoker) as before: only the ranking changes.
-- Replaces a function; touches no table data. Run on forgeload-dev first, then production only
-- with explicit approval.

create or replace function public.search_exercises(
  q text default '', muscle text default null, equip text default null,
  lim integer default 30, off integer default 0)
returns table (
  id uuid, name text, muscle_group text, equipment text,
  tracking_type text, load_convention text, is_custom boolean, rank real)
language sql stable
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
           coalesce(e.plan_eligible, false) as plan_eligible,
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
          + similarity(c.lname, (select nq from params)) * 10
          + case when c.plan_eligible then 3 else 0 end)::real as rank
    from cand c
   where not exists (
           select 1 from words w
            where not (c.hay like '%' || w.w || '%' or word_similarity(w.w, c.hay) >= case when length(w.w) >= 7 then 0.5 else 0.7 end))
   order by rank desc, c.name
   limit (select l from params) offset (select o from params)
$$;

-- Rollback (only with approval): re-run the search_exercises definition from 002_exercise_identity.sql.
