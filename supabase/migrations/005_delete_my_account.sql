-- 005_delete_my_account.sql
-- Purpose: let a signed-in user delete THEIR OWN account and all of their own data from inside the app.
--
-- Safe: ADDITIVE (one new function). Nothing existing changes. Run ONCE in the Supabase SQL Editor.
-- What it deletes: every row owned by the caller (user_id = the caller) in the public tables, then the
-- caller's login. Built-in exercises (no owner) and other users' rows are never touched.
-- It is all-or-nothing: if anything cannot be deleted, nothing is deleted and an error comes back.
-- Only the caller's own id is used. A user cannot name someone else.

begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  t record;
begin
  if uid is null then raise exception 'not signed in'; end if;

  -- A few passes so child rows are removed before their parents, whatever the foreign keys are.
  for pass in 1..6 loop
    for t in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables x
          on x.table_schema = c.table_schema and x.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'user_id' and x.table_type = 'BASE TABLE'
    loop
      begin
        execute format('delete from public.%I where user_id = $1', t.table_name) using uid;
      exception when foreign_key_violation then null;
      end;
    end loop;
  end loop;

  -- Verify nothing of theirs is left. If something is, stop and undo everything.
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables x
        on x.table_schema = c.table_schema and x.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'user_id' and x.table_type = 'BASE TABLE'
  loop
    declare left_rows bigint;
    begin
      execute format('select count(*) from public.%I where user_id = $1', t.table_name) into left_rows using uid;
      if left_rows > 0 then
        raise exception 'could not delete all data: % row(s) remain in %', left_rows, t.table_name;
      end if;
    end;
  end loop;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ROLLBACK: drop function if exists public.delete_my_account();
