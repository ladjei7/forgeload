// Default rest before the next set: the person's own setting first, then by exercise type and rep range.
import { RULES } from '../rules.ts';
import type { ExerciseProfile, Prescription } from './types.ts';

export function restFor(profile: Pick<ExerciseProfile, 'restOverride' | 'compound' | 'load' | 'measure'>, rx: Pick<Prescription, 'repMax'>): number {
  if (profile.restOverride && profile.restOverride >= 15 && profile.restOverride <= 900) return profile.restOverride;
  const r = RULES.restSeconds;
  const byRange = rx.repMax <= r.heavyMaxReps ? r.heavy : rx.repMax <= r.moderateMaxReps ? r.moderate : r.light;
  if (profile.measure === 'seconds') return RULES.restBodyweight;
  if (profile.compound === false) return Math.min(byRange, rx.repMax <= r.heavyMaxReps ? RULES.restIsolation.heavy : RULES.restIsolation.other);
  return byRange; // compound or unknown: unchanged from before
}
