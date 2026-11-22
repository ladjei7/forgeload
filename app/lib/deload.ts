// Deload weeks: a planned lighter week (about 2 sets per exercise, same weight, stop about 3 reps
// short). Marking one is basic logging and free. Pure helpers; the screen stores the choice.
import { addDays, weekStartOf } from './schedule.ts';

/** Device storage key for "the rest of this week is a deload": the last day (Sunday) it applies to. */
export const DELOAD_UNTIL_KEY = 'fl-deload-until';

/** Sunday of the week (Monday to Sunday) that contains `today` ('YYYY-MM-DD'). */
export function weekEnd(today: string): string {
  return addDays(weekStartOf(today), 6);
}

/** Should a workout started on `today` start as a deload? Only while a "rest of this week" choice covers it. */
export function deloadByDefault(until: string | null | undefined, today: string): boolean {
  return !!until && /^\d{4}-\d{2}-\d{2}$/.test(until) && today <= until && today >= weekStartOf(until);
}

/** Shown on the workout screen while a deload is on. A reminder, never applied automatically. */
export const DELOAD_HINT = 'Deload: about 2 sets per exercise at your usual weight, stopping about 3 reps short. It won’t change your next targets.';
