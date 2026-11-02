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

export const DEFAULT_INCREMENT = 5; // lb. Kept as a parameter so gyms/units can change it.

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
      reps: repMin,
      reason: `No history for this exercise yet. Pick a weight you can lift for ${repMin}-${repMax} reps with a rep or two to spare.`,
    };
  }

  // Judge the heaviest weight used. Lighter sets (warm-ups, back-offs) don't decide progression.
  const top = Math.max(...valid.map(s => s.weight));
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

// Simple rest default by rep range. Heavier, lower-rep work gets longer rest.
export function defaultRestSeconds(repMax: number): number {
  if (repMax <= 6) return 180;
  if (repMax <= 10) return 120;
  return 90;
}
