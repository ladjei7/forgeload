-- baseline.sql: the public schema of production (ltvhszozgzgymsbexgps) as of 2026-11-04, after migrations 001-010.
-- Generated from read-only catalog queries. Schema only: no user data, no exercise catalog rows.
-- Used to create the development project (forgeload-dev). Safe to run on an EMPTY project only.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.entitlements (user_id uuid not null, tier text default 'free'::text not null, status text default 'none'::text not null, current_period_end timestamp with time zone, source text default 'none'::text not null, updated_at timestamp with time zone default now() not null);
create table if not exists public.exercises (id uuid default gen_random_uuid() not null, name text not null, muscle_group text not null, equipment text not null, user_id uuid, aliases text[] default '{}'::text[] not null, secondary_muscles text[] default '{}'::text[] not null, movement_pattern text, category text, mechanic text, level text, is_unilateral boolean default false not null, tracking_type text default 'weight_reps'::text not null, load_convention text default 'total'::text not null, instructions text, source text, source_id text, source_version text, review_status text default 'legacy'::text not null, plan_eligible boolean default false not null, archived_at timestamp with time zone, comfort_level smallint);
create table if not exists public.workout_plans (id uuid default gen_random_uuid() not null, name text not null, is_active boolean default true, created_at timestamp with time zone default now(), user_id uuid default auth.uid() not null);
create table if not exists public.workout_days (id uuid default gen_random_uuid() not null, plan_id uuid not null, day_name text not null, sort_order integer default 0 not null, user_id uuid default auth.uid() not null);
create table if not exists public.plan_exercises (id uuid default gen_random_uuid() not null, workout_day_id uuid not null, exercise_name text not null, target_sets integer not null, rep_min integer not null, rep_max integer not null, sort_order integer default 0 not null, user_id uuid default auth.uid() not null, exercise_id uuid);
create table if not exists public.workout_sessions (id uuid default gen_random_uuid() not null, workout_day_id uuid, session_date date not null, notes text, created_at timestamp with time zone default now(), user_id uuid default auth.uid() not null, started_at timestamp with time zone default now() not null, completed_at timestamp with time zone);
create table if not exists public.exercise_logs (id uuid default gen_random_uuid() not null, workout_session_id uuid not null, exercise_name text not null, target_sets integer, target_rep_min integer, target_rep_max integer, user_id uuid default auth.uid() not null, exercise_id uuid);
create table if not exists public.exercise_sets (id uuid default gen_random_uuid() not null, exercise_log_id uuid not null, set_number integer not null, reps integer not null, weight numeric(8,2) default 0 not null, completed boolean default true, user_id uuid default auth.uid() not null, set_type text default 'working'::text not null, rir smallint, rpe numeric(3,1), skipped boolean default false not null);
create table if not exists public.search_abbreviations (abbr text not null, expansion text not null);
create table if not exists public.user_events (id bigint generated always as identity not null, user_id uuid not null, kind text not null, payload jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null);
create table if not exists public.user_exercise_prefs (user_id uuid default auth.uid() not null, exercise_id uuid not null, is_favorite boolean default false not null, last_used_at timestamp with time zone);
create table if not exists public.user_training_prefs (user_id uuid not null, comfort text default 'unsure'::text not null, avoid_exercise_ids text[] default '{}'::text[] not null, session_minutes smallint, updated_at timestamp with time zone default now() not null);

alter table public.entitlements add constraint entitlements_pkey PRIMARY KEY (user_id);
alter table public.exercise_logs add constraint exercise_logs_pkey PRIMARY KEY (id);
alter table public.exercise_sets add constraint exercise_sets_pkey PRIMARY KEY (id);
alter table public.exercises add constraint exercises_pkey PRIMARY KEY (id);
alter table public.plan_exercises add constraint plan_exercises_pkey PRIMARY KEY (id);
alter table public.search_abbreviations add constraint search_abbreviations_pkey PRIMARY KEY (abbr);
alter table public.user_events add constraint user_events_pkey PRIMARY KEY (id);
alter table public.user_exercise_prefs add constraint user_exercise_prefs_pkey PRIMARY KEY (user_id, exercise_id);
alter table public.user_training_prefs add constraint user_training_prefs_pkey PRIMARY KEY (user_id);
alter table public.workout_days add constraint workout_days_pkey PRIMARY KEY (id);
alter table public.workout_plans add constraint workout_plans_pkey PRIMARY KEY (id);
alter table public.workout_sessions add constraint workout_sessions_pkey PRIMARY KEY (id);
alter table public.entitlements add constraint entitlements_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text])));
alter table public.entitlements add constraint entitlements_status_check CHECK ((status = ANY (ARRAY['none'::text, 'active'::text, 'grace'::text, 'expired'::text])));
alter table public.exercise_sets add constraint exercise_sets_set_type_check CHECK ((set_type = ANY (ARRAY['working'::text, 'warmup'::text, 'drop'::text, 'failure'::text])));
alter table public.exercise_sets add constraint exercise_sets_rpe_check CHECK (((rpe >= (1)::numeric) AND (rpe <= (10)::numeric)));
alter table public.exercise_sets add constraint exercise_sets_rir_check CHECK (((rir >= 0) AND (rir <= 10)));
alter table public.exercises add constraint exercises_load_convention_check CHECK ((load_convention = ANY (ARRAY['total'::text, 'per_hand'::text, 'per_side'::text, 'per_implement'::text])));
alter table public.exercises add constraint exercises_tracking_type_check CHECK ((tracking_type = ANY (ARRAY['weight_reps'::text, 'bodyweight_reps'::text, 'added_weight_reps'::text, 'assisted_reps'::text, 'duration'::text, 'weight_duration'::text, 'distance_duration'::text])));
alter table public.exercises add constraint exercises_comfort_level_check CHECK (((comfort_level >= 1) AND (comfort_level <= 3)));
alter table public.user_events add constraint user_events_kind_check CHECK ((kind = ANY (ARRAY['swap'::text, 'skip'::text, 'feel'::text, 'suggestion'::text])));
alter table public.user_training_prefs add constraint user_training_prefs_comfort_check CHECK ((comfort = ANY (ARRAY['machines'::text, 'mixed'::text, 'all'::text, 'unsure'::text])));
alter table public.user_training_prefs add constraint user_training_prefs_session_minutes_check CHECK (((session_minutes >= 15) AND (session_minutes <= 180)));
alter table public.entitlements add constraint entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.exercise_logs add constraint exercise_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.exercise_logs add constraint exercise_logs_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE;
alter table public.exercise_logs add constraint exercise_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
alter table public.exercise_sets add constraint exercise_sets_exercise_log_id_fkey FOREIGN KEY (exercise_log_id) REFERENCES exercise_logs(id) ON DELETE CASCADE;
alter table public.exercise_sets add constraint exercise_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.exercises add constraint exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.plan_exercises add constraint plan_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
alter table public.plan_exercises add constraint plan_exercises_workout_day_id_fkey FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE CASCADE;
alter table public.plan_exercises add constraint plan_exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.user_events add constraint user_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_exercise_prefs add constraint user_exercise_prefs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
alter table public.user_training_prefs add constraint user_training_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workout_days add constraint workout_days_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE;
alter table public.workout_days add constraint workout_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.workout_plans add constraint workout_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.workout_sessions add constraint workout_sessions_workout_day_id_fkey FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE SET NULL;
alter table public.workout_sessions add constraint workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE INDEX exercise_logs_session_idx ON public.exercise_logs USING btree (workout_session_id);
CREATE INDEX exercise_logs_user_idx ON public.exercise_logs USING btree (user_id);
CREATE INDEX exercise_sets_log_idx ON public.exercise_sets USING btree (exercise_log_id);
CREATE INDEX exercise_sets_user_idx ON public.exercise_sets USING btree (user_id);
CREATE INDEX plan_exercises_day_idx ON public.plan_exercises USING btree (workout_day_id);
CREATE INDEX plan_exercises_user_idx ON public.plan_exercises USING btree (user_id);
CREATE INDEX workout_days_plan_idx ON public.workout_days USING btree (plan_id);
CREATE INDEX workout_days_user_idx ON public.workout_days USING btree (user_id);
CREATE INDEX workout_plans_user_idx ON public.workout_plans USING btree (user_id);
CREATE INDEX workout_sessions_day_idx ON public.workout_sessions USING btree (workout_day_id);
CREATE INDEX exercises_user_idx ON public.exercises USING btree (user_id);
CREATE INDEX user_exercise_prefs_exercise_idx ON public.user_exercise_prefs USING btree (exercise_id);
CREATE INDEX workout_sessions_user_completed_idx ON public.workout_sessions USING btree (user_id, completed_at DESC);
CREATE INDEX plan_exercises_exercise_id_idx ON public.plan_exercises USING btree (exercise_id);
CREATE INDEX exercise_logs_exercise_id_idx ON public.exercise_logs USING btree (exercise_id);
CREATE INDEX exercises_name_trgm_idx ON public.exercises USING gin (lower(name) extensions.gin_trgm_ops);
CREATE UNIQUE INDEX exercises_source_uidx ON public.exercises USING btree (source, source_id) WHERE (source IS NOT NULL);
CREATE INDEX user_events_user_time ON public.user_events USING btree (user_id, created_at DESC);

alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.user_training_prefs enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.search_abbreviations enable row level security;
alter table public.user_exercise_prefs enable row level security;
alter table public.exercises enable row level security;
alter table public.entitlements enable row level security;
alter table public.user_events enable row level security;

create policy "read exercises" on public.exercises as PERMISSIVE for SELECT to authenticated using (((user_id IS NULL) OR (user_id = auth.uid())));
create policy "add custom exercises" on public.exercises as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "read abbreviations" on public.search_abbreviations as PERMISSIVE for SELECT to authenticated using (true);
create policy exercises_own_rows_only_insert on public.exercises as RESTRICTIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy exercises_own_rows_only_update on public.exercises as RESTRICTIVE for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy exercises_own_rows_only_delete on public.exercises as RESTRICTIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "own prefs" on public.user_exercise_prefs as PERMISSIVE for ALL to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "own custom update" on public.exercises as PERMISSIVE for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "own custom delete" on public.exercises as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "own prefs select" on public.user_training_prefs as PERMISSIVE for SELECT to public using ((user_id = auth.uid()));
create policy "own prefs insert" on public.user_training_prefs as PERMISSIVE for INSERT to public with check ((user_id = auth.uid()));
create policy "own prefs update" on public.user_training_prefs as PERMISSIVE for UPDATE to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "own prefs delete" on public.user_training_prefs as PERMISSIVE for DELETE to public using ((user_id = auth.uid()));
create policy "own events select" on public.user_events as PERMISSIVE for SELECT to public using ((user_id = auth.uid()));
create policy "own events insert" on public.user_events as PERMISSIVE for INSERT to public with check ((user_id = auth.uid()));
create policy "read own entitlement" on public.entitlements as PERMISSIVE for SELECT to public using ((user_id = auth.uid()));
create policy "own rows" on public.workout_plans as PERMISSIVE for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "own rows" on public.workout_days as PERMISSIVE for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM workout_plans p WHERE ((p.id = workout_days.plan_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "own rows" on public.plan_exercises as PERMISSIVE for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM workout_days d WHERE ((d.id = plan_exercises.workout_day_id) AND (d.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "own rows" on public.workout_sessions as PERMISSIVE for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "own rows" on public.exercise_logs as PERMISSIVE for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM workout_sessions s WHERE ((s.id = exercise_logs.workout_session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "own rows" on public.exercise_sets as PERMISSIVE for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM exercise_logs l WHERE ((l.id = exercise_sets.exercise_log_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))));

CREATE OR REPLACE FUNCTION public.search_exercises(q text DEFAULT ''::text, muscle text DEFAULT NULL::text, equip text DEFAULT NULL::text, lim integer DEFAULT 30, off integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, muscle_group text, equipment text, tracking_type text, load_convention text, is_custom boolean, rank real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  with params as (
    select least(greatest(coalesce(lim, 30), 1), 50) as l,
           greatest(coalesce(off, 0), 0) as o,
           lower(btrim(regexp_replace(coalesce(q, ''), '[^a-zA-Z0-9]+', ' ', 'g'))) as nq
  ),
  words as (
    select distinct
      case when length(x.w) > 3 and x.w like '%s' and x.w not like '%ss'
           then left(x.w, length(x.w) - 1) else x.w end as w
    from params p
    cross join lateral regexp_split_to_table(p.nq, ' ') t(tok)
    left join search_abbreviations sa on sa.abbr = t.tok
    cross join lateral regexp_split_to_table(coalesce(sa.expansion, t.tok), ' ') x(w)
    where t.tok <> '' and x.w <> ''
  ),
  cand as (
    select e.id, e.name, e.muscle_group, e.equipment, e.tracking_type, e.load_convention, e.user_id,
           lower(e.name) as lname,
           lower(e.name || ' ' || coalesce(array_to_string(e.aliases, ' '), '') || ' '
                 || coalesce(e.muscle_group, '') || ' ' || coalesce(e.equipment, '')) as hay
      from exercises e
     where e.archived_at is null
       and (muscle is null or lower(e.muscle_group) = lower(muscle))
       and (equip  is null or lower(e.equipment)    = lower(equip))
  )
  select c.id, c.name, c.muscle_group, c.equipment, c.tracking_type, c.load_convention,
         (c.user_id is not null) as is_custom,
         (  case when c.lname = (select nq from params) then 100 else 0 end
          + case when c.lname like (select nq from params) || '%' then 20 else 0 end
          + (select coalesce(avg(word_similarity(w.w, c.lname)), 0) from words w) * 10
          + similarity(c.lname, (select nq from params)) * 10)::real as rank
    from cand c
   where not exists (
           select 1 from words w
            where not (c.hay like '%' || w.w || '%' or word_similarity(w.w, c.hay) >= case when length(w.w) >= 7 then 0.5 else 0.7 end))
   order by rank desc, c.name
   limit (select l from params) offset (select o from params)
$function$;

CREATE OR REPLACE FUNCTION public.exercise_facets()
 RETURNS TABLE(kind text, value text, n bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select 'muscle', muscle_group, count(*) from exercises
   where archived_at is null and muscle_group is not null group by muscle_group
  union all
  select 'equipment', equipment, count(*) from exercises
   where archived_at is null and equipment is not null group by equipment
$function$;

CREATE OR REPLACE FUNCTION public.my_exercises(kind text DEFAULT 'recent'::text, lim integer DEFAULT 15)
 RETURNS TABLE(id uuid, name text, muscle_group text, equipment text, tracking_type text, load_convention text, is_custom boolean, is_favorite boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select e.id, e.name, e.muscle_group, e.equipment, e.tracking_type, e.load_convention,
         (e.user_id is not null), p.is_favorite
    from user_exercise_prefs p
    join exercises e on e.id = p.exercise_id
   where p.user_id = auth.uid()
     and e.archived_at is null
     and ((kind = 'favorite' and p.is_favorite) or (kind = 'recent' and p.last_used_at is not null))
   order by case when kind = 'recent' then p.last_used_at end desc nulls last, e.name
   limit least(greatest(coalesce(lim, 15), 1), 30)
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  uid uuid := auth.uid();
  t record;
begin
  if uid is null then raise exception 'not signed in'; end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.my_tier()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select case when tier = 'pro' and (current_period_end is null or current_period_end + interval '7 days' > now()) and status in ('active','grace') then 'pro' else 'free' end
                   from entitlements where user_id = auth.uid()), 'free');
$function$;

CREATE OR REPLACE FUNCTION public.set_favorite(ex uuid, fav boolean)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  insert into user_exercise_prefs (exercise_id, is_favorite) values (ex, fav)
  on conflict (user_id, exercise_id) do update set is_favorite = fav;
$function$;

CREATE OR REPLACE FUNCTION public.touch_exercise(ex uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  insert into user_exercise_prefs (exercise_id, last_used_at) values (ex, now())
  on conflict (user_id, exercise_id) do update set last_used_at = now();
$function$;

-- Function grants exactly as production: no anon/public execute.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('search_exercises','exercise_facets','my_exercises','delete_my_account','my_tier','set_favorite','touch_exercise')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
