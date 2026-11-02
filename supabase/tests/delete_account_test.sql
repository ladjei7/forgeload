-- Run on a fresh DB after fixture.sql, 001, 002 (003 optional). Applies 005 itself.
\set ON_ERROR_STOP on
create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as
$$ begin if not ok then raise exception 'FAIL: %', label; else raise notice 'ok: %', label; end if; end $$;

create table if not exists auth.users (id uuid primary key);
create table exercise_sets (id uuid primary key default gen_random_uuid(), exercise_log_id uuid references exercise_logs, reps int, weight numeric);
grant select, insert, update, delete on all tables in schema public to authenticated;
grant delete on auth.users to authenticated;
\i supabase/migrations/005_delete_my_account.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2');
-- Each user gets a plan, a day, an exercise, a session, a log and a set. exercise_sets has no cascade and no user_id.
do $$ declare u uuid; p uuid; d uuid; s uuid; l uuid; begin
  foreach u in array array['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2']::uuid[] loop
    insert into workout_plans (name, user_id) values ('P', u) returning id into p;
    insert into workout_days (plan_id, day_name, sort_order, user_id) values (p, 'D', 0, u) returning id into d;
    insert into plan_exercises (workout_day_id, exercise_name, user_id) values (d, 'X', u);
    insert into workout_sessions (workout_day_id, user_id) values (d, u) returning id into s;
    insert into exercise_logs (workout_session_id, exercise_name, user_id) values (s, 'X', u) returning id into l;
    insert into exercise_sets (exercise_log_id, reps, weight) values (l, 5, 100);
    insert into exercises (name, muscle_group, equipment, user_id) values ('Custom ' || u, 'Chest', 'Cable', u);
  end loop;
end $$;

select pg_temp.check('anon cannot call it', not has_function_privilege('anon', 'public.delete_my_account()', 'execute'));
select pg_temp.check('signed-out call is refused', (select count(*) from (select 1) q) = 1);
do $$ begin
  begin perform public.delete_my_account(); raise exception 'FAIL: ran without a user';
  exception when others then if sqlerrm like 'FAIL%' then raise; else raise notice 'ok: refused when not signed in'; end if; end;
end $$;

-- exercise_sets has NO cascade and NO user_id, so the delete cannot finish: it must roll back completely.
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$ begin
  begin perform public.delete_my_account(); raise exception 'FAIL: should have been blocked';
  exception when others then if sqlerrm like 'FAIL%' then raise; else raise notice 'ok: blocked by orphan-prone table (%)', left(sqlerrm, 60); end if; end;
end $$;
reset role;
select pg_temp.check('rollback kept user A fully intact', (select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000a1') = 1
  and (select count(*) from workout_plans where user_id = '00000000-0000-0000-0000-0000000000a1') = 1);

-- With the cascade the real app is expected to have, it succeeds.
alter table exercise_sets drop constraint exercise_sets_exercise_log_id_fkey;
alter table exercise_sets add constraint exercise_sets_exercise_log_id_fkey foreign key (exercise_log_id) references exercise_logs on delete cascade;
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.delete_my_account();
reset role;
select pg_temp.check('user A login removed', (select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000a1') = 0);
select pg_temp.check('user A rows removed everywhere',
  (select count(*) from workout_plans where user_id = '00000000-0000-0000-0000-0000000000a1') = 0
  and (select count(*) from workout_sessions where user_id = '00000000-0000-0000-0000-0000000000a1') = 0
  and (select count(*) from exercise_logs where user_id = '00000000-0000-0000-0000-0000000000a1') = 0
  and (select count(*) from exercises where user_id = '00000000-0000-0000-0000-0000000000a1') = 0
  and (select count(*) from exercise_sets) = 1);
select pg_temp.check('user B untouched', (select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000b2') = 1
  and (select count(*) from workout_plans where user_id = '00000000-0000-0000-0000-0000000000b2') = 1
  and (select count(*) from exercises where user_id = '00000000-0000-0000-0000-0000000000b2') = 1);
select pg_temp.check('built-in exercises untouched', (select count(*) from exercises where user_id is null) >= 10);
