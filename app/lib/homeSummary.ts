// Pure helpers for the Home screen. No UI, no database. Nothing here invents data:
// with no history, last performance is null and the week is empty.
import { suggestTarget, defaultRestSeconds, workingWeight, workingSet, latestForTarget, type PrevSet, type Target } from './progression.ts';
import { RULES } from './rules.ts';

export type HistEntry = { name: string; exerciseId: string | null; at: string; is_deload?: boolean | null; sets: { set_number: number; reps: number; weight: number }[] };
export type PlanExLite = { name: string; exerciseId: string | null; sets: number; repMin: number; repMax: number };
export type ExSummary = { name: string; sets: number; repMin: number; repMax: number; last: PrevSet[] | null; lastShown: PrevSet | null; target: Target };

/** Sets of the session next time builds on (most recent non-deload). Matches by exercise id first, then by name. */
export function lastSets(hist: HistEntry[], ex: { name: string; exerciseId: string | null }): PrevSet[] | null {
  const nm = ex.name.trim().toLowerCase();
  const mine = hist
    .filter(h => (ex.exerciseId && h.exerciseId === ex.exerciseId) || (!h.exerciseId && h.name.trim().toLowerCase() === nm) || (!ex.exerciseId && h.name.trim().toLowerCase() === nm))
    ;
  const latest = latestForTarget(mine);
  if (!latest) return null;
  return [...latest.sets].sort((a, b) => a.set_number - b.set_number).map(s => ({ reps: s.reps, weight: s.weight }));
}

/** `convert` turns stored pounds into the person's unit; `step` is the weight jump in that unit. */
export function summarize(plan: PlanExLite[], hist: HistEntry[], convert: (lb: number) => number = x => x, step?: number,
  round: (w: number, above?: number) => number = w => Math.round(w * 10) / 10): ExSummary[] {
  return plan.map(p => {
    const raw = lastSets(hist, p);
    const last = raw ? raw.map(s => ({ ...s, weight: convert(s.weight) })) : null;
    const t = suggestTarget(last ?? [], p.repMin, p.repMax, step);
    const top = last?.length ? workingWeight(last) : 0;
    return { name: p.name, sets: p.sets, repMin: p.repMin, repMax: p.repMax, last, lastShown: last ? workingSet(last) : null, target: t.weight === null ? t : { ...t, weight: round(t.weight, t.action === 'add_weight' ? top : undefined) } };
  });
}

/** Monday 00:00 local of the week containing d. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Seven booleans, Monday first: did the user complete a workout that local day? */
export function weekDots(completedAt: string[], now: Date): boolean[] {
  const start = weekStart(now).getTime(), day = 24 * 3600 * 1000;
  const dots = Array<boolean>(7).fill(false);
  for (const iso of completedAt) {
    const t = new Date(iso); const local = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const i = Math.round((local - start) / day);
    if (i >= 0 && i < 7) dots[i] = true;
  }
  return dots;
}

export const todayIndex = (now: Date) => (now.getDay() + 6) % 7;

/** Rough minutes for a planned workout: work time plus the default rest after each set except the last. Shown as "about". */
export function estimateMinutes(plan: { sets: number; repMax: number }[]): number {
  const est = RULES.durationEstimate;
  let sec = 0, sets = 0;
  for (const p of plan) { sets += p.sets; sec += est.secondsSetupPerExercise + p.sets * (est.secondsPerSetWork + defaultRestSeconds(p.repMax)); }
  if (sets === 0) return 0;
  const last = plan[plan.length - 1];
  sec -= defaultRestSeconds(last.repMax); // no rest after the final set
  sec += est.secondsWarmup;
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** "Workout 2 of 4" in the rotation. Position of the next day, 1-based. */
export function rotationPosition(dayIds: string[], nextId: string | null): { n: number; of: number } | null {
  const i = nextId ? dayIds.indexOf(nextId) : -1;
  return i < 0 ? null : { n: i + 1, of: dayIds.length };
}
