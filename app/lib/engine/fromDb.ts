// Turns database rows into engine input. Pure, so it is unit tested without a database.
import { show, type Unit } from '../units.ts';
import type { PastSession } from './types.ts';

export type DbSet = { set_number: number; reps: number; weight: number; set_type?: string | null; skipped?: boolean | null; rir?: number | null };
export type DbSession = { id?: string | null; completed_at: string; is_deload?: boolean | null };
export type DbLog = {
  exercise_name: string; exercise_id: string | null;
  target_sets?: number | null; target_rep_min?: number | null; target_rep_max?: number | null;
  workout_sessions: DbSession | DbSession[] | null;
  exercise_sets: DbSet[] | null;
};

const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

/** Key for per-exercise settings: the library id, or the lower-cased name for custom and old exercises. */
export const exerciseKey = (ex: { exercise_id?: string | null; exercise_name: string }) =>
  ex.exercise_id ? ex.exercise_id : `name:${ex.exercise_name.trim().toLowerCase()}`;

/** Past sessions of one exercise in the person's unit, sets in logged order. Incomplete sessions are left out. */
export function toSessions(logs: DbLog[], unit: Unit): PastSession[] {
  const out: PastSession[] = [];
  for (const l of logs) {
    const s = one(l.workout_sessions);
    if (!s?.completed_at) continue;
    out.push({
      id: s.id ?? null, at: s.completed_at, isDeload: !!s.is_deload,
      prescription: l.target_rep_min && l.target_rep_max ? { sets: l.target_sets ?? 0, repMin: l.target_rep_min, repMax: l.target_rep_max } : null,
      sets: [...(l.exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number)
        .map(x => ({ weight: show(x.weight, unit), reps: x.reps, kind: x.set_type ?? null, skipped: x.skipped ?? null, rir: x.rir ?? null })),
    });
  }
  return out;
}
