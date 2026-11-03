-- 008_curate_plan_eligible.sql   (DRAFT. Run manually in the Supabase SQL Editor AFTER 006 and the repdb-01..12 import.)
-- Purpose: mark a small, hand-reviewed set of imported exercises as eligible for generated plans, with reviewed pattern and comfort level.
-- Safe: ADDITIVE. Only updates rows where source = 'repdb' and the slug below matches. Nothing is deleted or renamed. Run as many times as you like.
-- Contains no third-party text: only our own review decisions keyed by the source id.
begin;
with v(source_id, movement_pattern, comfort_level) as (values
  ('bench-press', 'hpush', 3),
  ('incline-bench-press', 'hpush', 3),
  ('db-bench-press', 'hpush', 2),
  ('incline-db-press', 'hpush', 2),
  ('chest-press-machine', 'hpush', 1),
  ('cable-chest-press', 'hpush', 1),
  ('cable-fly', 'fly', 1),
  ('db-fly', 'fly', 2),
  ('barbell-row', 'hpull', 3),
  ('single-arm-db-row', 'hpull', 2),
  ('seated-cable-row', 'hpull', 1),
  ('chest-supported-machine-row', 'hpull', 1),
  ('lat-pulldown', 'vpull', 1),
  ('close-grip-lat-pulldown', 'vpull', 1),
  ('pull-up', 'vpull', 3),
  ('ohp', 'vpush', 3),
  ('dumbbell-shoulder-press', 'vpush', 2),
  ('machine-shoulder-press', 'vpush', 1),
  ('squat', 'squat', 3),
  ('leg-press', 'squat', 1),
  ('hack-squat', 'squat', 1),
  ('db-goblet-squat', 'squat', 2),
  ('db-lunge', 'squat', 2),
  ('romanian-deadlift', 'hinge', 3),
  ('dumbbell-romanian-deadlift', 'hinge', 2),
  ('machine-back-extension', 'hinge', 1),
  ('leg-extension', 'kext', 1),
  ('seated-leg-curl', 'kflex', 1),
  ('leg-curl', 'kflex', 1),
  ('machine-calf-raise', 'calf', 1),
  ('standing-calf-raise', 'calf', 1),
  ('lateral-raise', 'lateral', 2),
  ('cable-lateral-raise', 'lateral', 1),
  ('face-pull', 'reardelt', 1),
  ('bicep-curl', 'biceps', 2),
  ('cable-curl', 'biceps', 1),
  ('barbell-curl', 'biceps', 3),
  ('cable-hammer-curl', 'biceps', 1),
  ('tricep-pushdown', 'triceps', 1),
  ('skull-crusher', 'triceps', 3),
  ('plank', 'core', 2),
  ('cable-crunch', 'core', 1)
)
update exercises e
   set movement_pattern = v.movement_pattern, comfort_level = v.comfort_level, review_status = 'reviewed', plan_eligible = true
  from v
 where e.source = 'repdb' and e.source_id = v.source_id and e.user_id is null;

-- Should return 42. If fewer, a slug was not imported yet or was renamed upstream.
select count(*) as plan_eligible_now from exercises where plan_eligible;
commit;
