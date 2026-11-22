// Basic (free) progression: configurable double progression.
// Pure functions only. No UI, no database, so they can be unit tested.
//
// Rule: stay at the same weight and add reps until EVERY working set reaches the
// top of the rep range, then add weight and drop back to the bottom of the range.
// This is one reasonable method, not the only one. Users can always override it.

export type PrevSet = { reps: number; weight: number };

export type TargetAction = 'start' | 'add_weight' | 'add_reps' | 'hold';

export type Target = {
  action: TargetAction;
  weight: number | null; // null when we cannot suggest a number
  reps: number | null;
  reason: string;
};

import { RULES } from './rules.ts';

export const DEFAULT_INCREMENT = RULES.progression.incrementLb; // lb. Kept as a parameter so gyms/units can change it.

export function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

export function suggestTarget(
  prev: PrevSet[],
  repMin: number,
  repMax: number,
  increment: number = DEFAULT_INCREMENT,
): Target {
  const valid = prev.filter(s => s.reps > 0 && s.weight >= 0);
  if (valid.length === 0) {
    return {
      action: 'start',
      weight: null,
      // The first-time headline says "stop at the top of the range", so an empty reps box means that.
      reps: repMax,
      reason: `No history for this exercise yet. Pick a weight you could lift about ${repMax + 2} times with good form, and stop at ${repMax}.`,
    };
  }

  const top = workingWeight(valid);
  const working = valid.filter(s => s.weight === top);
  const lowestReps = Math.min(...working.map(s => s.reps));

  if (lowestReps >= repMax) {
    if (top === 0) {
      return {
        action: 'add_weight',
        weight: null,
        reps: repMin,
        reason: `You reached ${repMax} reps on every set. Add a little weight or use a harder variation, then aim for ${repMin}+ reps.`,
      };
    }
    const next = top + increment;
    return {
      action: 'add_weight',
      weight: next,
      reps: repMin,
      reason: `You reached ${repMax}+ reps on every set at ${top}. Move up to ${next} and aim for ${repMin}+ reps.`,
    };
  }

  if (lowestReps < repMin) {
    return {
      action: 'hold',
      weight: top,
      reps: repMin,
      reason: `Your lowest set last time was ${lowestReps} reps, below the ${repMin} minimum. Stay at ${top} and build back up to ${repMin}.`,
    };
  }

  const reps = Math.min(repMax, lowestReps + 1);
  return {
    action: 'add_reps',
    weight: top,
    reps,
    reason: `Stay at ${top}. Your lowest set was ${lowestReps} reps, so aim for ${reps} on every set. Once every set hits ${repMax}, go up in weight.`,
  };
}

/**
 * The weight someone actually worked at: the weight used for the most sets. On a tie, the one used
 * later wins. So warm-ups don't count (fewer sets), a pyramid judges its last step, and a first set
 * that was too heavy (then dropped) doesn't push next time's target up.
 */
export function workingWeight(sets: PrevSet[]): number {
  const valid = sets.filter(s => s.reps > 0 && s.weight >= 0);
  if (!valid.length) return 0;
  const count = new Map<number, number>();
  for (const s of valid) count.set(s.weight, (count.get(s.weight) ?? 0) + 1);
  const most = Math.max(...count.values());
  for (let i = valid.length - 1; i >= 0; i--) if (count.get(valid[i].weight) === most) return valid[i].weight;
  return valid[valid.length - 1].weight;
}

/** The set to show as "Last": the most reps at the working weight. */
export function workingSet(sets: PrevSet[]): PrevSet | null {
  const w = workingWeight(sets);
  const at = sets.filter(s => s.reps > 0 && s.weight === w);
  return at.length ? at.reduce((a, b) => (b.reps > a.reps ? b : a)) : null;
}

/**
 * The past session next time's target builds on: the most recent one with at least one real set that
 * is NOT a deload. After a deload week, targets pick up from where the person was before it, not from
 * the lighter deload numbers. Older rows without the flag (null or missing) are normal sessions.
 */
export function latestForTarget<T extends { at: string; is_deload?: boolean | null; sets: { reps: number }[] | null }>(entries: T[]): T | undefined {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at)).find(e => !e.is_deload && (e.sets ?? []).some(s => s.reps > 0));
}

// Simple rest default by rep range. Heavier, lower-rep work gets longer rest.
export function defaultRestSeconds(repMax: number): number {
  const r = RULES.restSeconds;
  if (repMax <= r.heavyMaxReps) return r.heavy;
  if (repMax <= r.moderateMaxReps) return r.moderate;
  return r.light;
}
