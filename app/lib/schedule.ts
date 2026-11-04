// Scheduling rules: Flexible Rotation (default) and the optional Weekly Schedule.
// Pure functions on local dates ('YYYY-MM-DD' in the user's time zone). No database, no UI.
//
// Definitions (spec section 3.1):
//  - Scheduled session: in Weekly mode, a (weekday -> workout day) slot that falls on a date.
//  - Completed session: a session with completed_at set and at least one saved set. Counted on the
//    LOCAL date of completion, so a 11:30 pm workout counts for that day.
//  - Partially completed: started, never finished. NOT completed. Resume or discard comes first.
//  - Skipped: the user explicitly skipped it (a decision). Never inferred.
//  - Rescheduled: the user moved it to another date (a decision with a new date).
//  - Missed: a scheduled slot whose date has fully passed (date < today) with no completion of that
//    workout anywhere in the same training week and no decision about it. Never inferred from
//    "hasn't opened the app in days".
//  - Rest day: any date without a slot. Nothing is ever missed on a rest day.

export type Mode = 'rotation' | 'weekly';
/** weekday: 0 = Monday ... 6 = Sunday. */
export type Slot = { weekday: number; dayId: string };
/** since: the date the weekly schedule was turned on or last changed. Nothing before it can be missed. */
export type Schedule = { mode: Mode; weekStart: number; slots: Slot[]; since?: string };
export type Completion = { dayId: string; date: string };
export type Decision = { date: string; dayId: string; action: 'skipped' | 'rescheduled' | 'dismissed' | 'did_today_instead'; to?: string };
export type Occurrence = { date: string; dayId: string };

// ---- date helpers (local calendar math on Y-M-D strings; no time zone surprises) ----
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
/** 0 = Monday ... 6 = Sunday */
export const weekdayOf = (s: string) => (toDate(s).getUTCDay() + 6) % 7;
export function weekStartOf(s: string, weekStart = 0): string { return addDays(s, -((weekdayOf(s) - weekStart + 7) % 7)); }

/** Scheduled occurrences for the training week containing `date`. */
export function occurrencesForWeek(sch: Schedule, date: string): Occurrence[] {
  if (sch.mode !== 'weekly') return [];
  const start = weekStartOf(date, sch.weekStart);
  const seen = new Set<string>(); const out: Occurrence[] = [];
  for (const sl of sch.slots) {
    const date = addDays(start, (sl.weekday - sch.weekStart + 7) % 7);
    if (sch.since && date < sch.since) continue; // the schedule did not exist yet (or was different)
    const k = `${date}|${sl.dayId}`;
    if (seen.has(k)) continue; // a duplicated slot never creates two occurrences
    seen.add(k); out.push({ date, dayId: sl.dayId });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const sameWeek = (a: string, b: string, ws: number) => weekStartOf(a, ws) === weekStartOf(b, ws);

/** Missed workouts in the training week containing `weekDate`, judged as of `asOf`, oldest first. */
export function missedInWeek(sch: Schedule, weekDate: string, asOf: string, done: Completion[], decisions: Decision[]): Occurrence[] {
  if (sch.mode !== 'weekly') return [];
  const occ = occurrencesForWeek(sch, weekDate);
  const doneThisWeek = done.filter(c => sameWeek(c.date, weekDate, sch.weekStart));
  const used = new Set<number>(); // one completion satisfies one occurrence (two Upper A slots need two Upper A sessions)
  const missed: Occurrence[] = [];
  for (const o of occ) {
    const ci = doneThisWeek.findIndex((c, i) => !used.has(i) && c.dayId === o.dayId);
    if (ci >= 0) { used.add(ci); continue; }
    if (o.date >= asOf) continue; // the day is not over yet; late training still counts
    if (decisions.some(d => d.date === o.date && d.dayId === o.dayId)) continue;
    missed.push(o);
  }
  return missed;
}
export const missedThisWeek = (sch: Schedule, today: string, done: Completion[], decisions: Decision[]) => missedInWeek(sch, today, today, done, decisions);

/** Today's planned workout in Weekly mode, if any and not yet done. */
export function plannedToday(sch: Schedule, today: string, done: Completion[]): string | null {
  if (sch.mode !== 'weekly') return null;
  const o = occurrencesForWeek(sch, today).find(x => x.date === today);
  if (!o) return null;
  return done.some(c => c.date === today && c.dayId === o.dayId) ? null : o.dayId;
}

export type HomePrompt =
  | { kind: 'resume'; sessionId: string }
  | { kind: 'missed'; missed: Occurrence; today: string | null }
  | { kind: 'new_week'; unfinished: Occurrence[] }
  | { kind: 'none' };

/**
 * What Home should lead with. An unfinished workout always wins (resume or discard), and no
 * schedule prompt is ever shown while a workout is active.
 * `promptedKeys` are prompts the user already answered or dismissed, so nothing repeats.
 */
export function homePrompt(p: {
  sch: Schedule; today: string; done: Completion[]; decisions: Decision[];
  activeSessionId: string | null; promptedKeys: string[];
}): HomePrompt {
  if (p.activeSessionId) return { kind: 'resume', sessionId: p.activeSessionId };
  if (p.sch.mode !== 'weekly') return { kind: 'none' };
  const weekKey = `week:${weekStartOf(p.today, p.sch.weekStart)}`;
  if (!p.promptedKeys.includes(weekKey)) {
    const thisWeek = weekStartOf(p.today, p.sch.weekStart);
    const unfinished = missedInWeek(p.sch, addDays(thisWeek, -1), thisWeek, p.done, p.decisions);
    if (unfinished.length) return { kind: 'new_week', unfinished };
  }
  const missed = missedThisWeek(p.sch, p.today, p.done, p.decisions).filter(o => !p.promptedKeys.includes(`missed:${o.date}:${o.dayId}`));
  if (missed.length) return { kind: 'missed', missed: missed[missed.length - 1], today: plannedToday(p.sch, p.today, p.done) };
  return { kind: 'none' };
}

// ---- Flexible Rotation: explicit skips ----
export type RotationEvent = { dayId: string; at: string; kind: 'completed' | 'skipped' };
/** The rotation advances past the latest completed OR explicitly skipped workout. Partial sessions never count. */
export function rotationAnchor(events: RotationEvent[]): string | null {
  const last = [...events].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return last ? last.dayId : null;
}

/** Suggest a weekly schedule from a rotation: spread N workouts across the week with rest between where possible. */
export function suggestSchedule(dayIds: string[], weekStart = 0): Schedule {
  const n = Math.min(dayIds.length, 7);
  const patterns: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
  const days = patterns[n] ?? [];
  return { mode: 'weekly', weekStart, slots: days.map((w, i) => ({ weekday: (w + weekStart) % 7, dayId: dayIds[i] })) };
}
