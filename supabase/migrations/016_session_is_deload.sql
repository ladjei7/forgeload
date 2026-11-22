-- 016_session_is_deload.sql
-- Lets a person mark a workout as a deload (lighter week: fewer sets, same weight, stop short).
-- Deload sessions still count as training, but next week's targets, records and progress checks
-- skip them, so a planned light week never reads as a step back.
--
-- Additive only: one new column with a default. Existing rows become false (a normal session).
-- RLS: workout_sessions has one policy, "own rows", for ALL commands, using and with check
-- auth.uid() = user_id. It covers every column, so owners can update is_deload and nobody else can.
-- Run on forgeload-dev first, then production.

alter table public.workout_sessions add column if not exists is_deload boolean not null default false;

-- Rollback (only with approval; loses which sessions were deloads):
--   alter table public.workout_sessions drop column if exists is_deload;
