-- 017_cardio_muscle_group.sql
-- Persona test: cardio machines and conditioning moves were filed under one muscle (Air Bike under
-- Quads, Jump Rope under Calves, SkiErg under Back), and the 90/90 hip drills under Quads. Library
-- filters showed them in the wrong place.
--
-- Data only, built-in exercises only (user_id is null), matched by exact name: cardio moves get the
-- muscle group "Cardio"; the 90/90 drills (hip rotation) go to Glutes. Nothing else changes: same ids,
-- names, tracking and history. (016 is reserved for workout_sessions.is_deload.)

begin;

update public.exercises set muscle_group = 'Cardio'
 where user_id is null and muscle_group is distinct from 'Cardio'
   and name in ('Air Bike', 'Stationary Bike', 'Elliptical Trainer', 'Rowing Machine', 'Treadmill Running',
                'Incline Treadmill Walk', 'SkiErg', 'Jump Rope', 'Jumping Jacks', 'Burpees', 'Mountain Climbers',
                'Battle Ropes', 'Battle Rope Double Slam', 'Sled Push');

update public.exercises set muscle_group = 'Glutes'
 where user_id is null and muscle_group = 'Quads'
   and name in ('90/90 Hold', '90/90 Switch', 'Lean-Back 90/90 Hold');

commit;

-- Rollback (only with approval): set muscle_group back per name:
--   Quads: Air Bike, Stationary Bike, Elliptical Trainer, Rowing Machine, Treadmill Running, Incline Treadmill Walk,
--          Mountain Climbers, 90/90 Hold, 90/90 Switch, Lean-Back 90/90 Hold
--   Calves: Jump Rope, Jumping Jacks, Sled Push   Back: SkiErg   Glutes: Burpees   Shoulders: Battle Ropes, Battle Rope Double Slam
