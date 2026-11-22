import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, localNow, restAlertAction, restTtlSeconds, daysBetween, type ReminderPrefs, type ReminderState } from '../app/lib/reminders.ts';

const TZ = 'America/Chicago';
// 2026-11-23 is a Monday. 17:05 Chicago = 23:05 UTC.
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-06:00`);
const prefs = (p: Partial<ReminderPrefs> = {}): ReminderPrefs => ({ workoutReminders: true, comeback: false, reminderTime: '17:00', reminderDays: [], timezone: TZ, ...p });
const weekly = { mode: 'weekly' as const, weekStart: 0, slots: [{ weekday: 0, dayId: 'UA' }, { weekday: 2, dayId: 'LA' }], since: '2026-11-01' };
const rotation = { mode: 'rotation' as const, weekStart: 0, slots: [] };
const state = (s: Partial<ReminderState> = {}): ReminderState => ({
  schedule: weekly, dayNames: { UA: 'Upper A', LA: 'Lower A', UB: 'Upper B' }, rotationNextDayId: 'UB', lastCompletedDate: '2026-11-20',
  completedDates: ['2026-11-20'], sentReminderToday: false, sentComebackToday: false, comebacksSinceLastWorkout: 0, ...s,
});

test('local time and weekday in the person\'s time zone', () => {
  assert.deepEqual(localNow(at('2026-11-23', '17:05'), TZ), { date: '2026-11-23', minutes: 17 * 60 + 5, weekday: 0 });
  assert.equal(localNow(new Date('2026-11-24T03:00:00Z'), TZ).date, '2026-11-23'); // still Monday evening in Chicago
  assert.equal(localNow(new Date('2026-11-24T03:00:00Z'), 'Not/AZone').date, '2026-11-24'); // bad zone: UTC, no crash
  assert.equal(daysBetween('2026-11-20', '2026-11-27'), 7);
});

test('weekly schedule: reminder on planned days only, at or after the chosen time, once', () => {
  const m = decide(at('2026-11-23', '17:05'), prefs(), state());
  assert.deepEqual(m, { kind: 'reminder', title: 'Workout day', body: 'Upper A is planned for today.', url: '/log' });
  assert.equal(decide(at('2026-11-23', '16:55'), prefs(), state()), null, 'too early');
  assert.equal(decide(at('2026-11-23', '18:10'), prefs(), state()), null, 'window passed');
  assert.equal(decide(at('2026-11-24', '17:05'), prefs(), state()), null, 'Tuesday is a rest day');
  assert.equal(decide(at('2026-11-23', '17:05'), prefs(), state({ sentReminderToday: true })), null, 'already sent');
  assert.equal(decide(at('2026-11-23', '17:05'), prefs({ workoutReminders: false }), state()), null, 'turned off');
});

test('no reminder after a workout is already done today', () => {
  assert.equal(decide(at('2026-11-23', '17:05'), prefs(), state({ completedDates: ['2026-11-23'] })), null);
});

test('rotation: only on the picked days, names the next workout, never shows numbers', () => {
  const p = prefs({ reminderDays: [0, 3] });
  const m = decide(at('2026-11-23', '17:05'), p, state({ schedule: rotation }))!;
  assert.equal(m.body, 'Next up: Upper B.');
  assert.doesNotMatch(m.body + m.title, /\d/);
  assert.equal(decide(at('2026-11-24', '17:05'), p, state({ schedule: rotation })), null, 'Tuesday not picked');
  assert.equal(decide(at('2026-11-23', '17:05'), prefs({ reminderDays: [] }), state({ schedule: rotation })), null, 'no days picked');
});

test('comeback: day 7, one follow-up on day 14, then quiet; never for someone who never trained', () => {
  const p = prefs({ workoutReminders: false, comeback: true });
  const away = (date: string, n: number) => decide(at(date, '17:05'), p, state({ lastCompletedDate: '2026-11-16', completedDates: ['2026-11-16'], comebacksSinceLastWorkout: n }));
  assert.equal(away('2026-11-22', 0), null, 'day 6');
  assert.deepEqual(away('2026-11-23', 0), { kind: 'comeback', title: 'Ready when you are', body: 'Your next workout is waiting.', url: '/' });
  assert.equal(away('2026-11-24', 1), null, 'day 8: already sent');
  assert.equal(away('2026-11-30', 1)?.kind, 'comeback', 'day 14 follow-up');
  assert.equal(away('2026-12-07', 2), null, 'day 21: paused until they train again');
  assert.equal(decide(at('2026-11-23', '17:05'), p, state({ lastCompletedDate: null, completedDates: [] })), null, 'never trained');
});

test('comeback and workout reminder on the same day: one message', () => {
  const p = prefs({ comeback: true });
  const m = decide(at('2026-11-23', '17:05'), p, state({ lastCompletedDate: '2026-11-16', completedDates: ['2026-11-16'] }));
  assert.equal(m?.kind, 'comeback');
});

test('rest alerts: never early, never stale', () => {
  const due = 1_000_000;
  assert.equal(restAlertAction(due, due - 2000), 'wait');
  assert.equal(restAlertAction(due, due - 100), 'send');
  assert.equal(restAlertAction(due, due + 19_000), 'send');
  assert.equal(restAlertAction(due, due + 21_000), 'expire');
  assert.equal(restTtlSeconds(due, due), 20);
  assert.equal(restTtlSeconds(due, due + 18_000), 5);
});
