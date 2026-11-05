-- 012_session_day_name.sql
-- Keeps the workout's name on each session, so History still says "Lower B" after that workout is
-- deleted from a plan or the user switches plans. (Deleting a day sets workout_sessions.workout_day_id
-- to null, which loses the name today.)
--
-- Additive only: one new nullable column, one trigger, and a backfill that only fills empty values.
-- No row is deleted. No existing value is overwritten. Run on forgeload-dev first, then production
-- only with explicit approval.

begin;

alter table public.workout_sessions add column if not exists day_name text;

-- Fill the name when a session is created. Works for every app version, including phones still
-- running an older cached copy of the app, because the database does it, not the app.
create or replace function public.set_session_day_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.day_name is null and new.workout_day_id is not null then
    select d.day_name into new.day_name from public.workout_days d where d.id = new.workout_day_id;
  end if;
  return new;
end;
$$;

drop trigger if exists workout_sessions_day_name on public.workout_sessions;
create trigger workout_sessions_day_name
  before insert on public.workout_sessions
  for each row execute function public.set_session_day_name();

-- Backfill existing sessions from their workout's current name. Only empty values are filled.
update public.workout_sessions s
   set day_name = d.day_name
  from public.workout_days d
 where s.workout_day_id = d.id
   and s.day_name is null;

commit;

-- Rollback (only with approval): the column is harmless to keep. To remove everything:
--   drop trigger if exists workout_sessions_day_name on public.workout_sessions;
--   drop function if exists public.set_session_day_name();
--   alter table public.workout_sessions drop column if exists day_name;   -- loses the saved names
