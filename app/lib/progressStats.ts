import { show, label, type Unit } from './units.ts';

// Progress numbers, computed from finished workouts. Pure functions only (unit tested).
//
// "Strength estimate": the best set of a workout turned into one number, so that more weight and more
// reps both count. Epley formula, weight x (1 + reps / 30), with reps capped at 12 because the formula
// overestimates for long sets. Bodyweight sets (weight 0) are tracked by reps instead.

export type PSet = { reps: number | null; weight: number | null; set_type?: string | null; skipped?: boolean | null };
export type PLog = { exercise_name: string; exercise_id?: string | null; exercise_sets: PSet[] | null };
export type PSession = { id: string; completed_at: string; exercise_logs: PLog[] | null };

export type Point = { sessionId: string; date: Date; weight: number; reps: number; value: number; record: boolean };
export type LiftProgress = {
  key: string; name: string; kind: 'weight' | 'reps';
  points: Point[];            // oldest first, one per workout
  best: Point;                // best ever
  first: Point;
};
export type Summary = { workouts: number; thisMonth: number; weekStreak: number; recordsLast30: number };

export function strength(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + Math.min(reps, 12) / 30));
}

const counts = (s: PSet) => !s.skipped && (s.set_type ?? 'working') !== 'warmup' && (s.reps ?? 0) > 0;

/** Monday 00:00 local time of the week containing d. */
export function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function liftProgress(sessions: PSession[]): LiftProgress[] {
  const ordered = [...sessions].sort((a, b) => +new Date(a.completed_at) - +new Date(b.completed_at));
  const lifts = new Map<string, { name: string; pts: Omit<Point, 'record'>[]; bodyweight: boolean }>();
  for (const s of ordered) {
    const date = new Date(s.completed_at);
    for (const log of s.exercise_logs ?? []) {
      const sets = (log.exercise_sets ?? []).filter(counts);
      if (!sets.length) continue;
      const key = log.exercise_id ?? log.exercise_name.trim().toLowerCase();
      const entry = lifts.get(key) ?? { name: log.exercise_name, pts: [], bodyweight: true };
      entry.name = log.exercise_name; // latest name wins
      const weighted = sets.some(x => (x.weight ?? 0) > 0);
      if (weighted) entry.bodyweight = false;
      // Best set of this workout: highest strength estimate; for bodyweight, most reps.
      let best = sets[0];
      for (const x of sets) {
        const v = weighted ? strength(x.weight ?? 0, x.reps ?? 0) : (x.reps ?? 0);
        const bv = weighted ? strength(best.weight ?? 0, best.reps ?? 0) : (best.reps ?? 0);
        if (v > bv || (v === bv && (x.weight ?? 0) > (best.weight ?? 0))) best = x;
      }
      const prevSame = entry.pts.find(p => p.sessionId === s.id);
      const pt = { sessionId: s.id, date, weight: best.weight ?? 0, reps: best.reps ?? 0, value: 0 };
      if (prevSame) { // same exercise twice in one workout: keep the better one
        if (strength(pt.weight, pt.reps) > strength(prevSame.weight, prevSame.reps)) Object.assign(prevSame, pt);
      } else entry.pts.push(pt);
      lifts.set(key, entry);
    }
  }
  const out: LiftProgress[] = [];
  for (const [key, e] of lifts) {
    const kind: 'weight' | 'reps' = e.bodyweight ? 'reps' : 'weight';
    let top = -1;
    const points: Point[] = e.pts.map((p, i) => {
      const value = kind === 'weight' ? strength(p.weight, p.reps) : p.reps;
      const record = i > 0 && value > top; // the first time is a starting point, not a record
      top = Math.max(top, value);
      return { ...p, value, record };
    });
    const best = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
    out.push({ key, name: e.name, kind, points, best, first: points[0] });
  }
  // Most recently trained first.
  return out.sort((a, b) => +b.points[b.points.length - 1].date - +a.points[a.points.length - 1].date);
}

export function summary(sessions: PSession[], lifts: LiftProgress[], now = new Date()): Summary {
  const dates = sessions.map(s => new Date(s.completed_at));
  const thisMonth = dates.filter(d => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()).length;
  // Consecutive weeks with at least one workout, counting back from this week (or last week, so the
  // streak doesn't read 0 on a Monday morning before the first workout of the week).
  const weeks = new Set(dates.map(d => +weekStartOf(d)));
  let cursor = weekStartOf(now);
  if (!weeks.has(+cursor)) cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
  let weekStreak = 0;
  while (weeks.has(+cursor)) { weekStreak++; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7); }
  const since = +now - 30 * 864e5;
  const recordsLast30 = lifts.reduce((n, l) => n + l.points.filter(p => p.record && +p.date >= since).length, 0);
  return { workouts: sessions.length, thisMonth, weekStreak, recordsLast30 };
}

/** Records from the last `days` days, newest first, each with the previous best for comparison. */
export function recentRecords(lifts: LiftProgress[], now = new Date(), days = 30) {
  const since = +now - days * 864e5;
  const out: { lift: LiftProgress; point: Point; previous: Point }[] = [];
  for (const l of lifts) {
    l.points.forEach((p, i) => {
      if (!p.record || +p.date < since) return;
      const previous = l.points.slice(0, i).reduce((a, b) => (b.value > a.value ? b : a));
      out.push({ lift: l, point: p, previous });
    });
  }
  return out.sort((a, b) => +b.point.date - +a.point.date);
}

/** Weights are stored in pounds; shown in the person's unit. */
export function setLabel(p: { weight: number; reps: number }, unit: Unit = 'lb'): string {
  return p.weight > 0 ? `${show(p.weight, unit)} ${label(unit)} × ${p.reps}` : `${p.reps} reps`;
}
