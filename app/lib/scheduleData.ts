// Loading and saving the weekly schedule and the user's answers to schedule prompts.
// The rules themselves live in schedule.ts (pure, unit tested).
import { supabase } from './supabase';
import { addDays, localDate, type Completion, type Decision, type Occurrence, type Schedule, type Slot } from './schedule';

export const ROTATION: Schedule = { mode: 'rotation', weekStart: 0, slots: [] };

export async function loadSchedule(planId: string): Promise<Schedule> {
  const { data } = await supabase.from('plan_schedules').select('mode, week_start, slots, since').eq('plan_id', planId).maybeSingle();
  if (!data) return ROTATION;
  const r = data as { mode: 'rotation' | 'weekly'; week_start: number; slots: Slot[] | null; since: string | null };
  return { mode: r.mode, weekStart: r.week_start ?? 0, slots: Array.isArray(r.slots) ? r.slots : [], since: r.since ?? undefined };
}

/** Saving always restarts `since` at today, so nothing before the change can count as missed. */
export async function saveSchedule(planId: string, sch: Schedule) {
  return supabase.from('plan_schedules').upsert({
    plan_id: planId, mode: sch.mode, week_start: sch.weekStart, slots: sch.slots,
    since: localDate(new Date()), updated_at: new Date().toISOString(),
  }, { onConflict: 'plan_id' });
}

/** Everything the schedule rules need for one plan, for the last three weeks. */
export async function loadScheduleState(planId: string, dayIds: string[]): Promise<{ sch: Schedule; done: Completion[]; decisions: Decision[] }> {
  const sch = await loadSchedule(planId);
  if (sch.mode !== 'weekly' || !dayIds.length) return { sch, done: [], decisions: [] };
  const from = addDays(localDate(new Date()), -21);
  const [{ data: sess }, { data: dec }] = await Promise.all([
    // Only workouts with at least one saved set count as done.
    supabase.from('workout_sessions').select('workout_day_id, completed_at, exercise_logs!inner(exercise_sets!inner(id))')
      .in('workout_day_id', dayIds).not('completed_at', 'is', null).gte('completed_at', new Date(Date.now() - 22 * 864e5).toISOString()),
    supabase.from('schedule_decisions').select('occurrence_date, workout_day_id, action, rescheduled_to').eq('plan_id', planId).gte('occurrence_date', from),
  ]);
  const done: Completion[] = ((sess ?? []) as { workout_day_id: string; completed_at: string }[])
    .map(r => ({ dayId: r.workout_day_id, date: localDate(new Date(r.completed_at)) }));
  const decisions: Decision[] = ((dec ?? []) as { occurrence_date: string; workout_day_id: string; action: Decision['action']; rescheduled_to: string | null }[])
    .map(r => ({ date: r.occurrence_date, dayId: r.workout_day_id, action: r.action, to: r.rescheduled_to ?? undefined }));
  return { sch, done, decisions };
}

/** Store the user's answer to a prompt about one planned workout. One answer per occurrence. */
export async function answerPrompt(planId: string, occ: Occurrence, action: Decision['action'], to?: string) {
  return supabase.from('schedule_decisions').upsert({
    plan_id: planId, occurrence_date: occ.date, workout_day_id: occ.dayId, action, rescheduled_to: to ?? null,
  }, { onConflict: 'plan_id,occurrence_date,workout_day_id' });
}
