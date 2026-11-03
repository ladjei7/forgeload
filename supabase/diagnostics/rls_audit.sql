-- Read-only. Run as ONE query (select all, Run). Shows every table in public, whether RLS is on,
-- and each policy. Anything with rls_on = false, or a policy whose condition is "true" on a table
-- holding user data, needs fixing.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       coalesce(p.policyname, '(no policies)') as policy,
       p.cmd,
       p.roles,
       p.qual as using_condition,
       p.with_check
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relkind = 'r'
order by c.relname, p.policyname;
