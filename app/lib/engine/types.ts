// Progression engine: shared types. Pure data, no UI, no database.
//
// Weights here are in the person's display unit (lb or kg), already converted from the stored pounds.
// "reps" means seconds for exercises tracked by time (measure === 'seconds').
import type { Unit } from '../units.ts';

/** How a logged set should be read. Stored in exercise_sets.set_type ('top'/'backoff' are reserved for a later strategy). */
export type SetKind = 'working' | 'warmup' | 'drop' | 'failure' | 'top' | 'backoff';

export type LoggedSet = { weight: number; reps: number; kind?: SetKind | string | null; skipped?: boolean | null; rir?: number | null };

/** What the plan asked for: number of working sets and the rep (or seconds) range. */
export type Prescription = { sets: number; repMin: number; repMax: number };

/** One past session of this exercise. `prescription` is what the plan said at the time (null on old rows). */
export type PastSession = { id?: string | null; at: string; isDeload?: boolean | null; sets: LoggedSet[]; prescription?: Prescription | null };

export type Tracking = 'weight_reps' | 'bodyweight_reps' | 'added_weight_reps' | 'assisted_reps' | 'duration' | 'weight_duration' | 'distance_duration';

/** How the logged weight relates to the load: an external load, weight added to bodyweight, or machine assistance. */
export type LoadKind = 'external' | 'bodyweight' | 'assisted';

/** Everything the engine needs to know about the exercise and this person's settings for it. */
export type ExerciseProfile = {
  unit: Unit;
  load: LoadKind;
  measure: 'reps' | 'seconds';
  compound: boolean | null;     // null = unknown
  perDumbbell: boolean;         // the logged weight is one dumbbell (or one side), not the total
  step: number;                 // smallest sensible weight change, in `unit`
  stepSource: 'user' | 'equipment';
  equipmentLabel: string;       // used in explanations: "dumbbells", "the machine stack"
  restOverride?: number | null; // seconds, set by the person for this exercise
};

export type Action =
  | 'start'            // no usable history
  | 'add_weight'       // every planned set reached the top: go up one step
  | 'less_assistance'  // assisted: every set reached the top, use one step less help
  | 'harder_variation' // bodyweight or time at the top with nothing to add: make it harder
  | 'add_reps'         // same weight, one more rep on the set that needs it most
  | 'hold'             // same weight, same reps (e.g. finish the missing sets first)
  | 'review';          // the history doesn't support a confident target: say so

export type Recommendation = {
  strategy: string;               // 'double'
  version: string;                // which rules produced it, e.g. 'double-2'
  action: Action;
  weight: number | null;          // display unit; assistance for assisted exercises; null = no number to suggest
  repsBySet: number[] | null;     // one target per planned set (reps or seconds); null = none
  measure: 'reps' | 'seconds';
  restSeconds: number;
  short: string;                  // one short line shown on the card by default
  reason: string;                 // the full sentence, shown under "Why?" 
  details: string[];              // "Why this target?" lines
  caution?: string;               // something uncertain the person should know (full)
  cautionShort?: string;          // the same, in a few words for the card
  alternative?: { weight: number; repsBySet: number[]; label: string; reason: string }; // e.g. a lighter option after repeated misses
  basedOn: { at: string; sessionIds: string[] } | null;
};

/** A progression method. Double progression is the default; others plug in here without touching logging or history. */
export interface ProgressionStrategy {
  id: string;
  version: string;
  recommend(input: { sessions: PastSession[]; rx: Prescription; profile: ExerciseProfile }): Recommendation;
}
