-- Run after fixture.sql, 001 and 002 have been applied. Applies 003 itself.
\set ON_ERROR_STOP on
create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as
$$ begin if not ok then raise exception 'FAIL: %', label; else raise notice 'ok: %', label; end if; end $$;

\i supabase/migrations/003_exercise_prefs.sql

-- Two users; user A owns a private custom exercise.
insert into exercises (name, muscle_group, equipment, user_id) values
  ('A Private Row', 'Back', 'Cable', '00000000-0000-0000-0000-0000000000a1');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

-- recents order: touch bench, then squat, then bench again -> bench first
select touch_exercise((select id from exercises where name = 'Barbell Bench Press' and user_id is null));
select pg_sleep(0.01);
select touch_exercise((select id from exercises where name = 'Barbell Back Squat'));
select pg_sleep(0.01);
select touch_exercise((select id from exercises where name = 'Barbell Bench Press' and user_id is null));
select pg_temp.check('recents newest first', (select name from my_exercises('recent') limit 1) = 'Barbell Bench Press');
select pg_temp.check('recents has two rows, no duplicates', (select count(*) from my_exercises('recent')) = 2);
select pg_temp.check('touching twice does not create a second row', (select count(*) from user_exercise_prefs) = 2);

-- favorites
select set_favorite((select id from exercises where name = 'Lat Pulldown'), true);
select set_favorite((select id from exercises where name = 'A Private Row'), true);
select pg_temp.check('favorites returns starred only', (select count(*) from my_exercises('favorite')) = 2);
select set_favorite((select id from exercises where name = 'Lat Pulldown'), false);
select pg_temp.check('unstar removes it', (select count(*) from my_exercises('favorite')) = 1);
select pg_temp.check('favoriting does not erase recency', (select count(*) from my_exercises('recent')) = 2);

-- facets
select pg_temp.check('facets list muscles', (select count(*) from exercise_facets() where kind = 'muscle') >= 5);
select pg_temp.check('facets list equipment', (select count(*) from exercise_facets() where kind = 'equipment') >= 4);
select pg_temp.check('facet count is right', (select n from exercise_facets() where kind = 'equipment' and value = 'Machine') = 3);

-- archived exercises disappear from recents, favorites and facets, but the row is kept
update exercises set archived_at = now() where name = 'A Private Row';
select pg_temp.check('archived hidden from favorites', (select count(*) from my_exercises('favorite')) = 0);
select pg_temp.check('archived row still exists', (select count(*) from exercises where name = 'A Private Row') = 1);

-- isolation: user B sees nothing of A's prefs and cannot see A's private exercise facets
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select pg_temp.check('B has no recents', (select count(*) from my_exercises('recent')) = 0);
select pg_temp.check('B has no favorites', (select count(*) from my_exercises('favorite')) = 0);
select pg_temp.check('B cannot read A prefs table rows', (select count(*) from user_exercise_prefs) = 0);
-- B cannot write a pref row on behalf of A
do $$ begin
  begin
    insert into user_exercise_prefs (user_id, exercise_id, is_favorite)
      values ('00000000-0000-0000-0000-0000000000a1', (select id from exercises limit 1), true);
    raise exception 'FAIL: wrote as another user';
  exception when insufficient_privilege or check_violation then raise notice 'ok: cannot write another user''s prefs'; end;
end $$;
-- result cap
select pg_temp.check('limit capped at 30', (select count(*) from my_exercises('recent', 9999)) <= 30);
reset role;
select pg_temp.check('anon cannot call my_exercises', not has_function_privilege('anon', 'public.my_exercises(text,integer)', 'execute'));
select pg_temp.check('anon cannot call set_favorite', not has_function_privilege('anon', 'public.set_favorite(uuid,boolean)', 'execute'));
