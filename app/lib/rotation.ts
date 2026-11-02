// Program rotation: the next workout comes from what you last COMPLETED,
// not from the weekday. Missing a day never skips a workout.

export type DayRef = { id: string };

/**
 * @param days ordered days of the active plan
 * @param lastCompletedDayId the day of the most recent completed session in this plan, or null
 */
export function nextDayId(days: DayRef[], lastCompletedDayId: string | null): string | null {
  if (days.length === 0) return null;
  if (!lastCompletedDayId) return days[0].id;
  const i = days.findIndex(d => d.id === lastCompletedDayId);
  if (i === -1) return days[0].id; // last day was deleted or edited out: start from the top
  return days[(i + 1) % days.length].id;
}
