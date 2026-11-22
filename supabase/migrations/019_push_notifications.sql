-- 019_push_notifications.sql
-- Opt-in notifications: rest timer alerts (this device), workout reminders and comeback reminders.
-- All off by default. Applied to forgeload-dev for testing; production only after real-phone testing
-- and explicit approval.
--
-- Secrets live in Supabase Vault, never in code or chat:
--   push_vapid_private / push_vapid_public_jwk  created by the push function on first use (it generates
--                                              the key pair itself, so no person ever sees the private key)
--   push_cron_secret                             created here, shared only between the scheduler and the function
--   push_function_url                            this project's function URL (set once per environment)

create extension if not exists pg_net schema extensions;
create extension if not exists pg_cron;

-- Public settings the app needs (the VAPID public key). One row.
create table if not exists public.push_config (
  id smallint primary key default 1 check (id = 1),
  vapid_public_key text not null,
  updated_at timestamptz not null default now()
);

-- One row per device that allowed notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 64),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  platform text check (char_length(platform) <= 40),
  rest_alerts boolean not null default false,     -- rest timer alerts for THIS device
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_ok_at timestamptz,
  gone_at timestamptz,                             -- the push service said the subscription no longer exists
  unique (user_id, device_id)
);

-- Account-wide reminder settings.
create table if not exists public.push_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  workout_reminders boolean not null default false,
  comeback boolean not null default false,
  reminder_time time not null default '17:00',
  reminder_days smallint[] not null default '{}' check (reminder_days <@ array[0,1,2,3,4,5,6]::smallint[]), -- 0 = Monday; rotation only
  timezone text not null default 'America/Chicago' check (char_length(timezone) <= 64),
  updated_at timestamptz not null default now()
);

-- Scheduled rest alerts. Written only by the push function (service role): the app asks it to schedule
-- or cancel, so superseding is atomic. One pending alert per device at most.
create table if not exists public.rest_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  session_id uuid,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'expired', 'failed')),
  ack_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create unique index if not exists rest_alerts_one_pending on public.rest_alerts (subscription_id) where status = 'pending';
create index if not exists rest_alerts_due_idx on public.rest_alerts (due_at) where status = 'pending';
create index if not exists rest_alerts_user_idx on public.rest_alerts (user_id);

-- What was sent (reminders, comebacks, tests): one reminder and one comeback per local day.
create table if not exists public.push_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'comeback', 'test')),
  local_date date not null,
  ack_token uuid not null default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  devices int not null default 0,
  ok int not null default 0
);
create unique index if not exists push_log_once_a_day on public.push_log (user_id, kind, local_date) where kind in ('reminder', 'comeback');
create index if not exists push_log_user_idx on public.push_log (user_id, kind, local_date desc);

-- Delivery receipts from the phones: how late, and whether it was shown. Used to measure timing,
-- missed and duplicate alerts during testing.
create table if not exists public.push_acks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('rest', 'reminder', 'comeback', 'test')),
  ref text not null,                 -- rest_alerts.id or push_log.id
  device_id text,
  due_at timestamptz,
  received_at timestamptz not null default now(),
  delay_ms int,
  shown boolean not null,
  reason text check (char_length(reason) <= 60)
);
create index if not exists push_acks_user_idx on public.push_acks (user_id);
create index if not exists push_acks_ref_idx on public.push_acks (ref);

alter table public.push_config enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_prefs enable row level security;
alter table public.rest_alerts enable row level security;
alter table public.push_log enable row level security;
alter table public.push_acks enable row level security;

drop policy if exists "read" on public.push_config;
create policy "read" on public.push_config for select to authenticated using (true);
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own rows" on public.push_prefs;
create policy "own rows" on public.push_prefs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "read own" on public.rest_alerts;
create policy "read own" on public.rest_alerts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own" on public.push_log;
create policy "read own" on public.push_log for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own" on public.push_acks;
create policy "read own" on public.push_acks for select to authenticated using ((select auth.uid()) = user_id);

-- Vault access for the push function only (service role). Only push_* secrets.
create or replace function public.push_secret(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name and p_name like 'push\_%';
$$;
revoke execute on function public.push_secret(text) from public, anon, authenticated;
grant execute on function public.push_secret(text) to service_role;

-- First use: the function stores the key pair it generated. Never replaces an existing pair.
create or replace function public.push_store_keys(p_public_key text, p_public_jwk text, p_private_jwk text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name = 'push_vapid_private') then return false; end if;
  perform vault.create_secret(p_private_jwk, 'push_vapid_private', 'VAPID private key (JWK) for web push');
  perform vault.create_secret(p_public_jwk, 'push_vapid_public_jwk', 'VAPID public key (JWK) for web push');
  insert into public.push_config (id, vapid_public_key) values (1, p_public_key)
    on conflict (id) do update set vapid_public_key = excluded.vapid_public_key, updated_at = now();
  return true;
end $$;
revoke execute on function public.push_store_keys(text, text, text) from public, anon, authenticated;
grant execute on function public.push_store_keys(text, text, text) to service_role;

-- The shared secret the scheduler sends to the function (random, made here, never shown).
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron_secret', 'Scheduler -> push function');
  end if;
end $$;

-- Scheduler entry point. 'rest' runs every 5 seconds but only calls the function when an alert is due
-- within the next 6 seconds (the function then waits until the exact second). 'daily' runs every 5 minutes.
create or replace function public.push_tick(p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  if p_kind = 'rest' and not exists (
    select 1 from public.rest_alerts where status = 'pending' and due_at <= now() + interval '6 seconds') then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('action', p_kind),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-cron', v_secret),
    timeout_milliseconds := 60000);
end $$;
revoke execute on function public.push_tick(text) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('push-rest', 'push-daily');
select cron.schedule('push-rest', '5 seconds', $$select public.push_tick('rest')$$);
select cron.schedule('push-daily', '*/5 * * * *', $$select public.push_tick('daily')$$);

-- Set once per environment (not secret, kept with the others):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/push', 'push_function_url');
--
-- Rollback (only with approval):
--   select cron.unschedule('push-rest'); select cron.unschedule('push-daily');
--   drop table push_acks, push_log, rest_alerts, push_prefs, push_subscriptions, push_config;
--   drop function push_tick(text), push_store_keys(text, text, text), push_secret(text);
--   delete from vault.secrets where name like 'push\_%';
