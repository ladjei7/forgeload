-- Read-only, rolls back. Run as ONE query.
-- Acts as (a) a signed-in stranger with a random id and (b) a signed-out visitor, and counts what each can see.
-- PASS = every "stranger_sees" and "anon_sees" is 0, except exercises (shared library, stranger may read) and search_abbreviations.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
create temp table res(tbl text, stranger_sees bigint, anon_sees bigint) on commit drop;
grant all on res to public;
insert into res select 'workout_plans', count(*), null from workout_plans;
insert into res select 'workout_days', count(*), null from workout_days;
insert into res select 'plan_exercises', count(*), null from plan_exercises;
insert into res select 'workout_sessions', count(*), null from workout_sessions;
insert into res select 'exercise_logs', count(*), null from exercise_logs;
insert into res select 'exercise_sets', count(*), null from exercise_sets;
insert into res select 'user_exercise_prefs', count(*), null from user_exercise_prefs;
insert into res select 'user_training_prefs', count(*), null from user_training_prefs;
insert into res select 'user_events', count(*), null from user_events;
insert into res select 'entitlements', count(*), null from entitlements;
insert into res select 'custom exercises of others', count(*), null from exercises where user_id is not null;
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
update res set anon_sees = 0 where false;
-- anon cannot read most tables at all; count what it can (errors on permission denied are also a pass, so wrap)
do $$ declare t text; n bigint; begin
  foreach t in array array['workout_plans','workout_days','plan_exercises','workout_sessions','exercise_logs','exercise_sets','user_exercise_prefs','user_training_prefs','user_events','entitlements','exercises'] loop
    begin execute format('select count(*) from %I', t) into n;
    exception when others then n := 0; end;
    update res set anon_sees = n where tbl = case when t = 'exercises' then 'custom exercises of others' else t end;
  end loop; end $$;
reset role;
select * from res order by tbl;
rollback;
