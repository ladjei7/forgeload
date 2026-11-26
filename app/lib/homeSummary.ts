import { workingSet, latestForTarget, defaultRestSeconds, type PrevSet } from './progression.ts';
import { recommend, buildProfile, type ExerciseProfile, type Recommendation } from './engine/index.ts';
import { show, type Unit } from './units.ts';
import { RULES } from './rules.ts';

export type HistEntry = { name: string; exerciseId: string | null; at: string; is_deload?: boolean | null; sets: { set_number: number; reps: number; weight: number; set_type?: string | null; skipped?: boolean | null }[]; prescription?: { sets: number; repMin: number; repMax: number } | null };
export type PlanExLite = { name: string; exerciseId: string | null; sets: number; repMin: number; repMax: number };
export type ExSummary = { name: string; sets: number; repMin: number; repMax: number; last: PrevSet[] | null; lastShown: PrevSet | null; target: Recommendation };

const mineOf = (hist: HistEntry[], ex: { name: string; exerciseId: string | null }) => {
  const nm = ex.name.trim().toLowerCase();
  return hist.filter(h => (ex.exerciseId && h.exerciseId === ex.exerciseId) || (!h.exerciseId && h.name.trim().toLowerCase() === nm) || (!ex.exerciseId && h.name.trim().toLowerCase() === nm));
};

/** Sets of the session next time builds on (most recent non-deload). Matches by exercise id first, then by name. */
export function lastSets(hist: HistEntry[], ex: { name: string; exerciseId: string | null }): PrevSet[] | null {
  const latest = latestForTarget(mineOf(hist, ex));
  if (!latest) return null;
  return [...latest.sets].filter(s => !s.skipped && s.set_type !== 'warmup' && s.set_type !== 'drop').sort((a, b) => a.set_number - b.set_number).map(s => ({ reps: s.reps, weight: s.weight }));
}

/**
 * Up-next summary with the same engine as the workout screen. Weights in `hist` are stored pounds;
 * `profileFor` gives each exercise's profile (equipment, step), defaulting to plain weight x reps.
 */
export function summarize(plan: PlanExLite[], hist: HistEntry[], unit: Unit = 'lb', profileFor: (p: PlanExLite) => ExerciseProfile = () => buildProfile(null, unit)): ExSummary[] {
  return plan.map(p => {
    const raw = lastSets(hist, p);
    const last = raw ? raw.map(s => ({ ...s, weight: show(s.weight, unit) })) : null;
    const sessions = mineOf(hist, p).map(h => ({ at: h.at, isDeload: h.is_deload, prescription: h.prescription ?? null,
      sets: [...h.sets].sort((a, b) => a.set_number - b.set_number).map(x => ({ weight: show(x.weight, unit), reps: x.reps, kind: x.set_type ?? null, skipped: x.skipped ?? null })) }));
    const target = recommend(sessions, { sets: p.sets, repMin: p.repMin, repMax: p.repMax }, profileFor(p));
    return { name: p.name, sets: p.sets, repMin: p.repMin, repMax: p.repMax, last, lastShown: last ? workingSet(last) : null, target };
  });
}

/** Short target for a list: "70×9,8,8", "BW×12,12,12", "your call". */
export function compactTarget(t: Recommendation): string {
  const reps = t.repsBySet ? t.repsBySet.join(',') + (t.measure === 'seconds' ? 's' : '') : '';
  if (t.action === 'review') return 'your call';
  if (t.action === 'harder_variation') return `harder ×${reps}`;
  if (t.weight === null) return `×${reps}`;
  return t.weight === 0 ? `BW×${reps}` : `${t.weight}×${reps}`;
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
