// "Steady lately": is an exercise stalled? Pure logic, no UI or database.
//
// Built for double progression: stay at one weight, add reps until every working set reaches the top
// of the range, then add weight and drop back to the bottom. So progress between two sessions is:
//   - a heavier working weight, or
//   - the same working weight with more total reps, or a better lowest set, on the sets both had.
// The heaviest set alone is the wrong test: 10/9/8 -> 10/10/9 -> 10/10/10 is real progress with
// the same top set every time.
import { workingWeight, type PrevSet } from './progression.ts';
import { RULES } from './rules.ts';

export type StallSet = { weight: number; reps: number; set_type?: string | null; skipped?: boolean | null };
/** is_deload: a planned light session. Skipped by the stall check: it neither counts as progress nor breaks it. */
export type StallSession = { sets: StallSet[]; is_deload?: boolean | null };

/** Working sets only: no warm-ups, no skipped sets, no empty sets. Order is kept. */
export function workingSets(sets: StallSet[]): PrevSet[] {
  return sets.filter(s => s.set_type !== 'warmup' && !s.skipped && s.reps > 0 && s.weight >= 0).map(s => ({ weight: s.weight, reps: s.reps }));
}

/** The weight someone worked at that session and the reps of each set at that weight, in order. Null when nothing counts. */
export function snapshot(s: StallSession): { weight: number; reps: number[] } | null {
  const sets = workingSets(s.sets);
  if (!sets.length) return null;
  const weight = workingWeight(sets);
  return { weight, reps: sets.filter(x => x.weight === weight).map(x => x.reps) };
}

/** Did `next` improve on `prev`? (Same exercise, prev earlier.) */
export function progressed(prev: StallSession, next: StallSession): boolean {
  const a = snapshot(prev), b = snapshot(next);
  if (!a || !b) return false;
  if (b.weight > a.weight) return true; // moved up in weight
  if (b.weight < a.weight) return false; // moved down
  // Same weight (bodyweight is weight 0): compare only the sets both sessions have, so doing 2 sets
  // instead of 3 is not read as a drop.
  const n = Math.min(a.reps.length, b.reps.length);
  const ra = a.reps.slice(0, n), rb = b.reps.slice(0, n);
  const sum = (r: number[]) => r.reduce((x, y) => x + y, 0);
  return sum(rb) > sum(ra) || Math.min(...rb) > Math.min(...ra);
}

/**
 * Stalled: the last `n` eligible sessions (oldest first) show no progress from each one to the next.
 * Any session that improves on the one before it resets the count. Fewer than `n` eligible sessions
 * is never stalled.
 */
export function isStalled(sessionsOldestFirst: StallSession[], n: number = RULES.stall.sessions): boolean {
  const eligible = sessionsOldestFirst.filter(s => !s.is_deload && snapshot(s) !== null);
  if (eligible.length < n) return false;
  const last = eligible.slice(-n);
  for (let i = 1; i < last.length; i++) if (progressed(last[i - 1], last[i])) return false;
  return true;
}

export type LoggedSession = {
  completed_at: string;
  is_deload?: boolean | null;
  exercise_logs: { exercise_id?: string | null; exercise_name: string; exercise_sets: StallSet[] }[];
};

/**
 * Sessions per exercise, oldest first. Matched by library id, falling back to the name, the same way
 * Progress groups lifts. A swapped exercise has a different id, so it keeps its own history.
 */
export function historyByExercise(sessions: LoggedSession[]): Map<string, StallSession[]> {
  const out = new Map<string, StallSession[]>();
  for (const s of [...sessions].sort((a, b) => a.completed_at.localeCompare(b.completed_at))) {
    for (const log of s.exercise_logs) {
      const key = log.exercise_id ?? log.exercise_name.trim().toLowerCase();
      out.set(key, [...(out.get(key) ?? []), { sets: log.exercise_sets, is_deload: s.is_deload ?? false }]);
    }
  }
  return out;
}
