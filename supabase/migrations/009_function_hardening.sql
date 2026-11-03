-- 009_function_hardening.sql   (DRAFT. From the Supabase security advisor on 2026-11-02. Nothing here touches user data.)
begin;

-- my_tier() is SECURITY DEFINER and was executable by anon (Postgres grants EXECUTE to PUBLIC by default).
-- Signed-out visitors have no tier; only signed-in users need it.
revoke execute on function public.my_tier() from public, anon;
grant execute on function public.my_tier() to authenticated;

-- Pin search_path on four older functions so a schema lookalike cannot hijack them. Behavior is unchanged.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('touch_exercise','set_favorite','my_exercises','exercise_facets')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

commit;
