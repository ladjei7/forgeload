-- 014_training_prefs_areas_focus_unit.sql
-- Onboarding v2 answers, saved on the account so they can be edited in Settings and prefilled when
-- changing training days. Additive only: three columns with defaults. No row is changed or deleted.
-- Applied to forgeload-dev first; production only with explicit owner approval.
-- pain_areas is a person's own statement of what to go easy on (not a diagnosis); it only selects
-- gentler starting exercises and is included in export and account deletion like every other row.

alter table public.user_training_prefs
  add column if not exists pain_areas text[] not null default '{}'
    check (pain_areas <@ array['shoulders', 'lower_back', 'knees', 'wrists', 'elbows']::text[]),
  add column if not exists focus text[] not null default '{}'
    check (focus <@ array['legs', 'chest_back', 'arms', 'shoulders']::text[] and cardinality(focus) <= 2),
  add column if not exists unit text not null default 'lb' check (unit in ('lb', 'kg'));

-- Rollback (only with approval): drop the three columns (loses the saved answers).
