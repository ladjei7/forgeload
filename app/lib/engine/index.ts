// Progression engine entry point. Screens call `recommend`; it never throws, so a bug here can't block logging.
import { doubleProgression } from './double.ts';
import { restFor } from './rest.ts';
import type { ExerciseProfile, PastSession, Prescription, ProgressionStrategy, Recommendation } from './types.ts';

/** Available methods. Add new ones here; history and logging don't change. */
export const STRATEGIES: Record<string, ProgressionStrategy> = { double: doubleProgression };
export const DEFAULT_STRATEGY = 'double';

export function recommend(sessions: PastSession[], rx: Prescription, profile: ExerciseProfile, strategyId: string = DEFAULT_STRATEGY): Recommendation {
  const s = STRATEGIES[strategyId] ?? STRATEGIES[DEFAULT_STRATEGY];
  try {
    return s.recommend({ sessions, rx, profile });
  } catch {
    return { strategy: s.id, version: s.version, action: 'review', weight: null, repsBySet: null, measure: profile.measure, restSeconds: restFor(profile, rx),
      short: 'No target this time. Log as usual.', reason: 'Couldn’t work out a target this time. Log as usual; your sets are saved normally.', details: [], basedOn: null };
  }
}

export { buildProfile, stepText, loadableWeight, type ExerciseMeta, type ExerciseSettings } from './loading.ts';
export { readWorking } from './sets.ts';
export type { ExerciseProfile, PastSession, Prescription, Recommendation, LoggedSet, SetKind } from './types.ts';

/** "185 lb × 8, 8, 8" or "Bodyweight × 12, 12, 12" or "40s, 40s, 35s". */
export function headline(r: Recommendation, unit: string): string {
  const reps = r.repsBySet ? (r.measure === 'seconds' ? r.repsBySet.map(x => `${x}s`).join(', ') : r.repsBySet.join(', ')) : '';
  if (r.action === 'review') return 'Your call today';
  if (r.action === 'harder_variation') return `Harder variation × ${reps}`;
  if (r.weight === null) return reps ? `× ${reps}` : '';
  if (r.weight === 0) return r.measure === 'seconds' ? `Hold ${reps}` : `Bodyweight × ${reps}`;
  return `${r.weight} ${unit}${r.action === 'less_assistance' ? ' assist' : ''} × ${reps}`;
}
