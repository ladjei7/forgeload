-- READ-ONLY report. Run in the Supabase SQL Editor after 002. Changes nothing.

-- 1. How many plan/log rows are linked to a catalog exercise?
select 'plan_exercises' as tbl, count(*) filter (where exercise_id is not null) as linked,
       count(*) filter (where exercise_id is null) as unlinked from plan_exercises
union all
select 'exercise_logs', count(*) filter (where exercise_id is not null),
       count(*) filter (where exercise_id is null) from exercise_logs;

-- 2. Names that did NOT link (typos, renamed exercises, ambiguous names): review these by hand.
select exercise_name, count(*) as uses
  from (select exercise_name from plan_exercises where exercise_id is null
        union all select exercise_name from exercise_logs where exercise_id is null) x
 group by exercise_name order by uses desc, exercise_name;

-- 3. Duplicate exercise names inside the catalog (candidates for review, never auto-merged).
select lower(btrim(name)) as name, count(*) from exercises group by 1 having count(*) > 1;

-- 4. Row-level security on exercises: confirm the policies are what you expect.
select policyname, permissive, cmd, roles from pg_policies where tablename = 'exercises' order by policyname;
