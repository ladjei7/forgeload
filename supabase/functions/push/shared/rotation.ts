// Program rotation: the next workout comes from what you last COMPLETED,
// not from the weekday. Missing a day never skips a workout.

export type DayRef = { id: string };

/**
 * @param days ordered days of the active plan
 * @param lastCompletedDayId the day of the most recent completed session in this plan, or null
 * @param canStart optional: return false for days that cannot be started (for example, no
 *   exercises added yet). Those days are skipped. If NO day can be started, plain rotation applies.
 */
export function nextDayId(
  days: DayRef[],
  lastCompletedDayId: string | null,
  canStart: (id: string) => boolean = () => true,
): string | null {
  if (days.length === 0) return null;
  // -1 means "no usable last day": start from the top (also when the last day was deleted).
  const start = lastCompletedDayId ? days.findIndex(d => d.id === lastCompletedDayId) : -1;
  for (let step = 1; step <= days.length; step++) {
    const d = days[(start + step) % days.length];
    if (canStart(d.id)) return d.id;
  }
  return days[(start + 1) % days.length].id;
}
