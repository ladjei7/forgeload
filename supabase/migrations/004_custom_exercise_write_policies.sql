-- 004_custom_exercise_write_policies.sql
-- Purpose: let each user edit, archive and delete THEIR OWN custom exercises.
-- Symptom fixed: "Deleted" appeared but the exercise stayed (no policy allowed the delete, so 0 rows changed).
--
-- Safe: ADDITIVE. Only rows where user_id = your own id are affected. Built-in exercises
-- (user_id null) stay protected by the restrictive policies added in 002.
-- Run ONCE in the Supabase SQL Editor. Deleting an exercise keeps plan and log rows (their
-- exercise_id becomes empty; the saved name and numbers stay).

begin;
grant select, insert, update, delete on exercises to authenticated;

drop policy if exists "own custom update" on exercises;
create policy "own custom update" on exercises for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own custom delete" on exercises;
create policy "own custom delete" on exercises for delete to authenticated
  using (user_id = auth.uid());
commit;

-- ROLLBACK:
-- drop policy if exists "own custom update" on exercises;
-- drop policy if exists "own custom delete" on exercises;
