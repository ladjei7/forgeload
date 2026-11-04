import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missedThisWeek, homePrompt, occurrencesForWeek, plannedToday, rotationAnchor, suggestSchedule, weekdayOf, weekStartOf, type Schedule } from '../app/lib/schedule.ts';

// Week of Mon 2026-11-02 .. Sun 2026-11-08. Upper A Mon, Lower A Tue, Upper B Thu, Lower B Fri.
const W: Schedule = { mode: 'weekly', weekStart: 0, since: '2026-11-02', slots: [{ weekday: 0, dayId: 'UA' }, { weekday: 1, dayId: 'LA' }, { weekday: 3, dayId: 'UB' }, { weekday: 4, dayId: 'LB' }] };
const R: Schedule = { ...W, mode: 'rotation' };
const base = { decisions: [], activeSessionId: null, promptedKeys: [] as string[] };

test('calendar helpers: Monday-based weekdays and week starts', () => {
  assert.equal(weekdayOf('2026-11-02'), 0); assert.equal(weekdayOf('2026-11-08'), 6);
  assert.equal(weekStartOf('2026-11-05'), '2026-11-02'); assert.equal(weekStartOf('2026-11-05', 6), '2026-11-01');
});
test('rotation mode never reports a missed workout', () => {
  assert.deepEqual(missedThisWeek(R, '2026-11-06', [], []), []);
  assert.equal(homePrompt({ ...base, sch: R, today: '2026-11-06', done: [] }).kind, 'none');
});
test('missing one scheduled workout', () => {
  const m = missedThisWeek(W, '2026-11-04', [{ dayId: 'UA', date: '2026-11-02' }], []);
  assert.deepEqual(m, [{ date: '2026-11-03', dayId: 'LA' }]);
});
test('missing two in a row: both listed, the prompt asks about the latest', () => {
  const m = missedThisWeek(W, '2026-11-04', [], []);
  assert.equal(m.length, 2);
  const p = homePrompt({ ...base, sch: W, today: '2026-11-04', done: [] });
  assert.equal(p.kind, 'missed'); if (p.kind === 'missed') assert.equal(p.missed.dayId, 'LA');
});
test('training late the same day is not missed', () => {
  assert.deepEqual(missedThisWeek(W, '2026-11-02', [], []), [], 'Monday is not over on Monday');
  assert.deepEqual(missedThisWeek(W, '2026-11-03', [{ dayId: 'UA', date: '2026-11-02' }], []), [], '11:30 pm Monday counts for Monday');
});
test('completing it on an unscheduled day (or early) satisfies it', () => {
  assert.deepEqual(missedThisWeek(W, '2026-11-05', [{ dayId: 'UA', date: '2026-11-02' }, { dayId: 'LA', date: '2026-11-04' }], []), []);
});
test('an explicit skip, reschedule or dismissal is never reported as missed', () => {
  for (const action of ['skipped', 'rescheduled', 'dismissed'] as const)
    assert.deepEqual(missedThisWeek(W, '2026-11-04', [{ dayId: 'UA', date: '2026-11-02' }], [{ date: '2026-11-03', dayId: 'LA', action }]), [], action);
});
test('an unfinished workout always comes first, and blocks schedule prompts', () => {
  assert.deepEqual(homePrompt({ ...base, sch: W, today: '2026-11-06', done: [], activeSessionId: 's9' }), { kind: 'resume', sessionId: 's9' });
});
test('a prompt the user answered is not shown again', () => {
  const p = homePrompt({ ...base, sch: W, today: '2026-11-04', done: [{ dayId: 'UA', date: '2026-11-02' }], promptedKeys: ['missed:2026-11-03:LA'] });
  assert.equal(p.kind, 'none');
});
test('nothing before the schedule existed is ever missed (changing the schedule resets the baseline)', () => {
  assert.equal(homePrompt({ ...base, sch: { ...W, since: '2026-11-09' }, today: '2026-11-09', done: [] }).kind, 'none');
});
test('skipping a whole week: the next week offers one review, never a forced reset', () => {
  const p = homePrompt({ ...base, sch: W, today: '2026-11-09', done: [] });
  assert.equal(p.kind, 'new_week'); if (p.kind === 'new_week') assert.equal(p.unfinished.length, 4);
  const again = homePrompt({ ...base, sch: W, today: '2026-11-10', done: [], promptedKeys: ['week:2026-11-09'] });
  assert.notEqual(again.kind, 'new_week', 'asked once per week');
});
test('a full week done: no new-week prompt', () => {
  const done = [['UA', '02'], ['LA', '03'], ['UB', '05'], ['LB', '06']].map(([d, n]) => ({ dayId: d, date: `2026-11-${n}` }));
  assert.equal(homePrompt({ ...base, sch: W, today: '2026-11-09', done }).kind, 'none');
});
test('repeating an earlier workout does not satisfy a different one', () => {
  assert.deepEqual(missedThisWeek(W, '2026-11-04', [{ dayId: 'UA', date: '2026-11-02' }, { dayId: 'UA', date: '2026-11-03' }], []), [{ date: '2026-11-03', dayId: 'LA' }]);
});
test('the same workout twice a week needs two sessions; duplicate slots never double count', () => {
  const twice: Schedule = { mode: 'weekly', weekStart: 0, slots: [{ weekday: 0, dayId: 'FB' }, { weekday: 2, dayId: 'FB' }, { weekday: 2, dayId: 'FB' }] };
  assert.equal(occurrencesForWeek(twice, '2026-11-04').length, 2);
  assert.equal(missedThisWeek(twice, '2026-11-05', [{ dayId: 'FB', date: '2026-11-02' }], []).length, 1);
});
test('a custom week start (Sunday) is respected', () => {
  const sun: Schedule = { ...W, weekStart: 6 };
  assert.equal(occurrencesForWeek(sun, '2026-11-02')[0].date >= '2026-11-01', true);
});
test('today\'s planned workout, and nothing on rest days', () => {
  assert.equal(plannedToday(W, '2026-11-05', []), 'UB');
  assert.equal(plannedToday(W, '2026-11-04', []), null, 'Wednesday is a rest day');
  assert.equal(plannedToday(W, '2026-11-05', [{ dayId: 'UB', date: '2026-11-05' }]), null);
});
test('switching modes: the same history gives no prompts in rotation mode', () => {
  assert.equal(homePrompt({ ...base, sch: { ...W, mode: 'rotation' }, today: '2026-11-09', done: [] }).kind, 'none');
});
test('rotation: an explicit skip advances; a partial session is never an event', () => {
  assert.equal(rotationAnchor([{ dayId: 'UA', at: '2026-11-02T18:00:00Z', kind: 'completed' }, { dayId: 'LA', at: '2026-11-03T09:00:00Z', kind: 'skipped' }]), 'LA');
  assert.equal(rotationAnchor([]), null);
});
test('a suggested schedule spreads workouts with rest days', () => {
  const s = suggestSchedule(['UA', 'LA', 'UB', 'LB']);
  assert.deepEqual(s.slots.map(x => x.weekday), [0, 1, 3, 4]);
  assert.deepEqual(suggestSchedule(['A', 'B', 'C']).slots.map(x => x.weekday), [0, 2, 4]);
});
