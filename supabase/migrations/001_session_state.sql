-- 001_session_state.sql
-- Purpose: let the app tell an in-progress workout from a finished one, so it can
-- resume an unfinished session and work out the next workout in the rotation.
--
-- Safe: ADDITIVE only. No tables or columns are dropped, no rows are deleted.
-- The old app code keeps working after this runs (it never reads these columns).
-- Run ONCE, in the Supabase SQL Editor, before testing the Phase 1 branch.
-- RLS: existing policies on workout_sessions cover the new columns automatically.

begin;

alter table workout_sessions
  add column if not exists started_at timestamptz not null default now();

alter table workout_sessions
  add column if not exists completed_at timestamptz;

-- Backfill: every session logged before this migration counts as completed.
-- Use the session's own date (noon) so old sessions keep their real order,
-- instead of all getting the migration timestamp.
update workout_sessions
set started_at   = (session_date::timestamp + interval '12 hours'),
    completed_at = (session_date::timestamp + interval '12 hours')
where completed_at is null;

create index if not exists workout_sessions_user_completed_idx
  on workout_sessions (user_id, completed_at desc);

commit;

-- ROLLBACK (only if needed; this removes the in-progress/complete distinction):
-- drop index if exists workout_sessions_user_completed_idx;
-- alter table workout_sessions drop column if exists completed_at;
-- alter table workout_sessions drop column if exists started_at;
