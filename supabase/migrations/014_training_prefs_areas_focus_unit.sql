-- 014_training_prefs_areas_focus_unit.sql
-- Onboarding v2 answers, saved on the account so they can be edited in Settings and prefilled when
-- changing training days. Additive only: four columns with defaults. No row is changed or deleted.
-- Approved by the owner 2026-11-20 ("do the necessary and merge"). Applied to forgeload-dev first.
--
-- injury_notes: the person's own words ("bad left knee"); pain_areas: body areas read from them.
-- Used only to choose gentler starting exercises. Not a diagnosis. Included in export and removed
-- with the account like every other row.

alter table public.user_training_prefs
  add column if not exists pain_areas text[] not null default '{}'
    check (pain_areas <@ array['shoulders', 'lower_back', 'knees', 'wrists', 'elbows', 'hips', 'ankles', 'neck']::text[]),
  add column if not exists injury_notes text check (char_length(injury_notes) <= 300),
  add column if not exists focus text[] not null default '{}'
    check (focus <@ array['legs', 'chest_back', 'arms', 'shoulders']::text[] and cardinality(focus) <= 2),
  add column if not exists unit text not null default 'lb' check (unit in ('lb', 'kg'));

-- Rollback (only with approval): drop the four columns (loses the saved answers).
