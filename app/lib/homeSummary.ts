// Pure helpers for the Home screen. No UI, no database. Nothing here invents data:
// with no history, last performance is null and the week is empty.
import { suggestTarget, defaultRestSeconds, type PrevSet, type Target } from './progression.ts';
import { RULES } from './rules.ts';

export type HistEntry = { name: string; exerciseId: string | null; at: string; sets: { set_number: number; reps: number; weight: number }[] };
export type PlanExLite = { name: string; exerciseId: string | null; sets: number; repMin: number; repMax: number };
export type ExSummary = { name: string; sets: number; repMin: number; repMax: number; last: PrevSet[] | null; target: Target };

/** Most recent completed session's sets for an exercise. Matches by exercise id first, then by name. */
export function lastSets(hist: HistEntry[], ex: { name: string; exerciseId: string | null }): PrevSet[] | null {
  const nm = ex.name.trim().toLowerCase();
  const mine = hist
    .filter(h => (ex.exerciseId && h.exerciseId === ex.exerciseId) || (!h.exerciseId && h.name.trim().toLowerCase() === nm) || (!ex.exerciseId && h.name.trim().toLowerCase() === nm))
    .filter(h => h.sets.some(s => s.reps > 0))
    .sort((a, b) => b.at.localeCompare(a.at));
  const latest = mine[0];
  if (!latest) return null;
  return [...latest.sets].sort((a, b) => a.set_number - b.set_number).map(s => ({ reps: s.reps, weight: s.weight }));
}

export function summarize(plan: PlanExLite[], hist: HistEntry[]): ExSummary[] {
  return plan.map(p => {
    const last = lastSets(hist, p);
    return { name: p.name, sets: p.sets, repMin: p.repMin, repMax: p.repMax, last, target: suggestTarget(last ?? [], p.repMin, p.repMax) };
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
  let sec = 0, sets = 0;
  for (const p of plan) { sets += p.sets; sec += p.sets * (RULES.durationEstimate.secondsPerSetWork + defaultRestSeconds(p.repMax)); }
  if (sets === 0) return 0;
  const last = plan[plan.length - 1];
  sec -= defaultRestSeconds(last.repMax); // no rest after the final set
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** "Workout 2 of 4" in the rotation. Position of the next day, 1-based. */
export function rotationPosition(dayIds: string[], nextId: string | null): { n: number; of: number } | null {
  const i = nextId ? dayIds.indexOf(nextId) : -1;
  return i < 0 ? null : { n: i + 1, of: dayIds.length };
}
