-- 007_entitlements.sql   (DRAFT. Not run. No billing exists yet; this only defines where the tier will live.)
-- Rule: entitlements gate premium ANALYSIS and RECOMMENDATIONS only. No policy in this file touches workout data.
-- Users can READ their own tier. Nobody signed in can write it: only the server (service role, from a verified billing webhook) can.
begin;

create table if not exists entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  status text not null default 'none' check (status in ('none','active','grace','expired')),
  current_period_end timestamptz,
  source text not null default 'none',   -- e.g. 'billing-webhook', 'manual-grant'
  updated_at timestamptz not null default now()
);
alter table entitlements enable row level security;
create policy "read own entitlement" on entitlements for select using (user_id = auth.uid());
-- Intentionally no insert/update/delete policy: authenticated users cannot grant themselves Pro.

-- Effective tier, with a 7 day grace after the period ends. Missing row means free.
create or replace function public.my_tier() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select case when tier = 'pro' and (current_period_end is null or current_period_end + interval '7 days' > now()) and status in ('active','grace') then 'pro' else 'free' end
                   from entitlements where user_id = auth.uid()), 'free');
$$;
grant execute on function public.my_tier() to authenticated;

commit;
