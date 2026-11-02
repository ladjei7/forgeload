-- Run after fixture.sql, 001 and 002. Raises an exception on the first failed check.
\set ON_ERROR_STOP on
create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as
$$ begin if not ok then raise exception 'FAIL: %', label; else raise notice 'ok: %', label; end if; end $$;

-- Seed two users' data BEFORE assertions (as superuser, bypassing RLS)
insert into exercises (name, muscle_group, equipment, user_id) values
 ('My Weird Curl','Biceps','Cable','00000000-0000-0000-0000-0000000000a1'),
 ('Barbell Bench Press','Chest','Barbell','00000000-0000-0000-0000-0000000000a1'); -- user-owned duplicate name
insert into plan_exercises (exercise_name, user_id) values
 ('Barbell Bench Press','00000000-0000-0000-0000-0000000000b2'),   -- exact -> built-in only visible to b2
 ('romanian deadlift  ','00000000-0000-0000-0000-0000000000b2'),   -- case/space -> mapped
 ('Barbell Back Sqaut','00000000-0000-0000-0000-0000000000b2'),    -- typo -> stays NULL
 ('Barbell Bench Press','00000000-0000-0000-0000-0000000000a1');   -- ambiguous (built-in + own dup) -> NULL
\i supabase/migrations/002_exercise_identity.sql

-- Backfill
select pg_temp.check('exact name linked', (select exercise_id is not null from plan_exercises where exercise_name='Barbell Bench Press' and user_id='00000000-0000-0000-0000-0000000000b2'));
select pg_temp.check('case/space-insensitive link', (select exercise_id is not null from plan_exercises where exercise_name like 'romanian%'));
select pg_temp.check('typo NOT guessed', (select exercise_id is null from plan_exercises where exercise_name='Barbell Back Sqaut'));
select pg_temp.check('ambiguous NOT guessed', (select exercise_id is null from plan_exercises where user_id='00000000-0000-0000-0000-0000000000a1'));
select pg_temp.check('names never modified', (select count(*) from plan_exercises where exercise_name in ('Barbell Back Sqaut','romanian deadlift  '))=2);
select pg_temp.check('no exercises lost', (select count(*) from exercises where user_id is null)=16);

-- Search (as an authenticated user)
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select pg_temp.check('RDL finds Romanian deadlifts', (select count(*) from search_exercises('RDL') where name ilike '%romanian deadlift%')=2);
select pg_temp.check('RDL: Romanian Deadlift ranks before unrelated', (select name from search_exercises('rdl') limit 1) ilike '%romanian deadlift%');
select pg_temp.check('lat pulldown', (select count(*) from search_exercises('lat pulldown') where name ilike '%pulldown%')=2);
select pg_temp.check('incline chest finds incline presses', (select count(*) from search_exercises('incline chest') where name ilike 'incline%')=2);
select pg_temp.check('incline chest excludes cable fly', (select count(*) from search_exercises('incline chest') where name='Cable Fly')=0);
select pg_temp.check('cable curls -> Cable Curl first', (select name from search_exercises('cable curls') limit 1)='Cable Curl');
select pg_temp.check('typo "romanain deadlift"', (select count(*) from search_exercises('romanain deadlift') where name ilike '%romanian%')>=1);
select pg_temp.check('exact name ranks first', (select name from search_exercises('lat pulldown') limit 1)='Lat Pulldown');
select pg_temp.check('muscle filter', (select count(*) from search_exercises('', 'Biceps'))=3); -- 3 built-in biceps; user a1's private curl is hidden from b2
select pg_temp.check('equipment filter', (select bool_and(equipment='Cable') from search_exercises('', null, 'Cable')));
select pg_temp.check('limit is capped at 50', (select count(*) from search_exercises('', null, null, 9999))<=50);
select pg_temp.check('other user''s custom exercise is invisible', (select count(*) from search_exercises('weird'))=0);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select pg_temp.check('owner sees own custom exercise', (select count(*) from search_exercises('weird'))=1);

-- Built-in rows are protected even though the fixture has a deliberately weak policy
update exercises set name='HACKED' where user_id is null;
select pg_temp.check('built-ins cannot be edited', (select count(*) from exercises where name='HACKED')=0);
do $$ begin
  begin insert into exercises (name, user_id) values ('Fake builtin', null); raise exception 'FAIL: inserted built-in';
  exception when insufficient_privilege or check_violation then raise notice 'ok: cannot insert built-in'; end;
end $$;
delete from exercises where user_id is null;
select pg_temp.check('built-ins cannot be deleted', (select count(*) from exercises where user_id is null)=16);
update exercises set name='My Renamed Curl' where name='My Weird Curl';
select pg_temp.check('owner can edit own custom exercise', (select count(*) from exercises where name='My Renamed Curl')=1);
reset role;
select pg_temp.check('anon cannot call search', not has_function_privilege('anon','public.search_exercises(text,text,text,integer,integer)','execute'));
