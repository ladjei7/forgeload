// What a set would be logged as, and whether any number in it is only a suggestion.
//
// A suggestion (today's target, or last time's numbers when there is no target) must never be saved
// as performance without an explicit tap that names it ("Hit target: 100 lb × 10"). Typed numbers
// are performance. Pure, so it is unit tested.

export type EntryInput = {
  typedWeight: string;            // what the person typed ('' = empty box)
  typedReps: string;
  targetWeight: number | null;    // today's target weight (null = none)
  targetReps: number | null;      // today's target for this set (null = none)
  prevWeight?: number | null;     // last time's matching set, used only when there is no target
  prevReps?: number | null;
  emptyWeightIsZero: boolean;     // bodyweight, timed holds: an empty weight box means no added weight
};

export type Entry =
  | { ok: true; weight: number; reps: number; suggested: boolean; suggestedParts: ('weight' | 'reps')[] }
  | { ok: false; missing: ('weight' | 'reps')[] };

export function resolveEntry(x: EntryInput): Entry {
  const parts: ('weight' | 'reps')[] = [];
  let weight: number | null = null, reps: number | null = null;

  if (x.typedWeight.trim() !== '') weight = parseFloat(x.typedWeight);
  else if (x.emptyWeightIsZero && (x.targetWeight === null || x.targetWeight === 0)) weight = 0;
  else if (x.targetWeight !== null) { weight = x.targetWeight; parts.push('weight'); }
  else if (x.prevWeight != null) { weight = x.prevWeight; parts.push('weight'); }

  if (x.typedReps.trim() !== '') reps = parseInt(x.typedReps, 10);
  else if (x.targetReps !== null) { reps = x.targetReps; parts.push('reps'); }
  else if (x.prevReps != null) { reps = x.prevReps; parts.push('reps'); }

  const missing: ('weight' | 'reps')[] = [];
  if (weight === null || !Number.isFinite(weight) || weight < 0) missing.push('weight');
  if (reps === null || !Number.isFinite(reps) || reps <= 0) missing.push('reps');
  if (missing.length) return { ok: false, missing };
  return { ok: true, weight: weight!, reps: reps!, suggested: parts.length > 0, suggestedParts: parts };
}
