-- Read-only. Shows who can READ the exercises table, so we can keep imported library data to signed-in users (RepDB licence: in-app use, not a public API).
-- Paste the result (policy names and expressions only, no data) back to Claude.
select policyname, permissive, roles, cmd, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'exercises' and cmd in ('SELECT', 'ALL');
select relrowsecurity as rls_enabled from pg_class where oid = 'public.exercises'::regclass;
select has_table_privilege('anon', 'public.exercises', 'select') as anon_can_select;
