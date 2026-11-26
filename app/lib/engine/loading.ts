// What kind of load an exercise uses, and the smallest sensible change for it.
import { RULES } from '../rules.ts';
import type { Unit } from '../units.ts';
import type { ExerciseProfile, LoadKind, Tracking } from './types.ts';

/** Library facts about an exercise (all optional: custom exercises may have none). */
export type ExerciseMeta = {
  tracking?: string | null;   // exercises.tracking_type
  equipment?: string | null;  // exercises.equipment
  load?: string | null;       // exercises.load_convention
  mechanic?: string | null;   // compound | isolation
};
/** This person's settings for the exercise (exercise_settings), in pounds and seconds. */
export type ExerciseSettings = { weightStepLb?: number | null; restSeconds?: number | null };

const LB_PER_KG = 2.20462262;

export function buildProfile(meta: ExerciseMeta | null | undefined, unit: Unit, settings?: ExerciseSettings | null): ExerciseProfile {
  const tracking = (meta?.tracking ?? 'weight_reps') as Tracking;
  const equipment = meta?.equipment ?? null;
  const load: LoadKind = tracking === 'assisted_reps' ? 'assisted'
    : tracking === 'bodyweight_reps' || tracking === 'added_weight_reps' || tracking === 'duration' || equipment === 'Bodyweight' ? 'bodyweight'
    : 'external';
  const measure = tracking === 'duration' || tracking === 'weight_duration' ? 'seconds' : 'reps';
  // A dumbbell's weight is logged per dumbbell however the library labels it ("total" on many rows).
  const perDumbbell = equipment === 'Dumbbell' || equipment === 'Kettlebell' || meta?.load === 'per_hand' || meta?.load === 'per_implement' || meta?.load === 'per_side';
  const def = RULES.steps[equipment ?? ''] ?? RULES.steps.default;
  const user = settings?.weightStepLb && settings.weightStepLb > 0 ? settings.weightStepLb : null;
  const step = user ? (unit === 'kg' ? Math.round((user / LB_PER_KG) * 100) / 100 : user) : (unit === 'kg' ? def.kg : def.lb);
  return {
    unit, load, measure, perDumbbell,
    compound: meta?.mechanic === 'compound' ? true : meta?.mechanic === 'isolation' ? false : null,
    step, stepSource: user ? 'user' : 'equipment',
    equipmentLabel: equipmentLabel(equipment),
    restOverride: settings?.restSeconds ?? null,
  };
}

function equipmentLabel(eq: string | null): string {
  switch (eq) {
    case 'Dumbbell': return 'dumbbells';
    case 'Kettlebell': return 'kettlebells';
    case 'Barbell': return 'barbells';
    case 'Smith Machine': return 'Smith machines';
    case 'Machine': return 'machine stacks';
    case 'Cable': return 'cable stacks';
    case 'Bodyweight': return 'added weight';
    default: return 'this exercise';
  }
}

/** A weight you can load: kg to the nearest 0.5, lb to the nearest 0.1 (both cover every real plate and stack). */
export function loadableWeight(w: number, unit: Unit): number {
  return unit === 'kg' ? Math.round(w * 2) / 2 : Math.round(w * 10) / 10;
}

/** "5 lb per dumbbell" / "10 lb" / "2.5 kg" */
export function stepText(p: ExerciseProfile): string {
  return `${trim(p.step)} ${p.unit}${p.perDumbbell ? (p.equipmentLabel === 'kettlebells' ? ' per kettlebell' : ' per dumbbell') : ''}`;
}
export const trim = (n: number) => String(Math.round(n * 100) / 100);
