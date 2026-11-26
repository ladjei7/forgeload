-- 022_library_tracking_fixes.sql
-- Library rows whose tracking type didn't match how they are logged (shared library only, user_id is null).
-- Past workouts are not touched: only how future targets and the logger read these exercises.
--   Plank: held for time (templates use 30-60 s), was "weight x reps".
--   Pull-Up / Chin-Up on bodyweight: the weight box is added weight, was "weight x reps".
--   Assisted pull-ups on a machine: the weight is assistance, so less is progress, was "weight x reps".
-- Rollback: set tracking_type = 'weight_reps' for the same names.
update public.exercises set tracking_type = 'duration'
  where user_id is null and tracking_type = 'weight_reps' and name in ('Plank');
update public.exercises set tracking_type = 'bodyweight_reps'
  where user_id is null and tracking_type = 'weight_reps' and equipment = 'Bodyweight' and name in ('Pull-Up', 'Chin-Up', 'Chin-Ups');
update public.exercises set tracking_type = 'assisted_reps'
  where user_id is null and tracking_type = 'weight_reps' and equipment = 'Machine' and name in ('Assisted Pull-Up', 'Assisted Pull Ups');
