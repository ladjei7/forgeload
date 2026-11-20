import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strength, liftProgress, summary, recentRecords, weekStartOf, setLabel, type PSession } from '../app/lib/progressStats.ts';

const S = (id: string, iso: string, logs: [string, [number, number][], string?][]): PSession => ({
  id, completed_at: iso,
  exercise_logs: logs.map(([name, sets, exId]) => ({ exercise_name: name, exercise_id: exId ?? null, exercise_sets: sets.map(([weight, reps]) => ({ weight, reps })) })),
});

test('strength estimate: more weight or more reps both raise it; long sets are capped', () => {
  assert.equal(strength(100, 10), 133);
  assert.ok(strength(100, 11) > strength(100, 10));
  assert.ok(strength(105, 10) > strength(100, 10));
  assert.equal(strength(100, 20), strength(100, 12));
  assert.equal(strength(0, 10), 0); assert.equal(strength(100, 0), 0);
});

test('one point per workout, best set chosen, first time is not a record, a later best is', () => {
  const lifts = liftProgress([
    S('a', '2026-11-02T18:00:00', [['Bench', [[135, 8], [135, 7]]]]),
    S('b', '2026-11-05T18:00:00', [['Bench', [[135, 10], [140, 6]]]]),
    S('c', '2026-11-09T18:00:00', [['Bench', [[135, 9]]]]),
  ]);
  assert.equal(lifts.length, 1);
  const b = lifts[0];
  assert.deepEqual(b.points.map(p => [p.weight, p.reps]), [[135, 8], [135, 10], [135, 9]]);
  assert.deepEqual(b.points.map(p => p.record), [false, true, false]);
  assert.equal(setLabel(b.best), '135 lb × 10');
});

test('warm-up and skipped sets never count; empty logs are ignored', () => {
  const lifts = liftProgress([{
    id: 'a', completed_at: '2026-11-02T18:00:00', exercise_logs: [
      { exercise_name: 'Squat', exercise_sets: [{ weight: 225, reps: 10, set_type: 'warmup' }, { weight: 185, reps: 8 }, { weight: 315, reps: 5, skipped: true }] },
      { exercise_name: 'Curl', exercise_sets: [] },
    ],
  }]);
  assert.equal(lifts.length, 1);
  assert.deepEqual([lifts[0].best.weight, lifts[0].best.reps], [185, 8]);
});

test('bodyweight exercises are tracked by reps', () => {
  const lifts = liftProgress([
    S('a', '2026-11-02T18:00:00', [['Pull Up', [[0, 6], [0, 5]]]]),
    S('b', '2026-11-04T18:00:00', [['Pull Up', [[0, 8]]]]),
  ]);
  assert.equal(lifts[0].kind, 'reps');
  assert.deepEqual(lifts[0].points.map(p => p.value), [6, 8]);
  assert.equal(setLabel(lifts[0].best), '8 reps');
});

test('the same exercise is grouped by library id even if renamed; most recent lift listed first', () => {
  const lifts = liftProgress([
    S('a', '2026-11-02T18:00:00', [['DB Row', [[50, 10]], 'x1'], ['Leg Press', [[200, 10]]]]),
    S('b', '2026-11-06T18:00:00', [['Single-Arm Dumbbell Row', [[55, 10]], 'x1']]),
  ]);
  assert.equal(lifts.length, 2);
  assert.equal(lifts[0].name, 'Single-Arm Dumbbell Row');
  assert.equal(lifts[0].points.length, 2);
});

test('summary: workouts this month, week streak (tolerates an empty current week), records in 30 days', () => {
  const sessions = [
    S('a', '2026-10-27T18:00:00', [['Bench', [[100, 8]]]]),  // week of Oct 26
    S('b', '2026-11-03T18:00:00', [['Bench', [[100, 10]]]]), // week of Nov 2, record
    S('c', '2026-11-12T18:00:00', [['Bench', [[105, 9]]]]),  // week of Nov 9, record (105x9 beats 100x10)
  ];
  const lifts = liftProgress(sessions);
  const now = new Date('2026-11-16T09:00:00'); // Monday, nothing yet this week
  assert.deepEqual(summary(sessions, lifts, now), { workouts: 3, thisMonth: 2, weekStreak: 3, recordsLast30: 2 });
  assert.equal(summary(sessions, lifts, new Date('2026-11-25T09:00:00')).weekStreak, 0); // a full week missed
});

test('recent records come newest first with the previous best to compare', () => {
  const lifts = liftProgress([
    S('a', '2026-11-02T18:00:00', [['Bench', [[100, 8]]]]),
    S('b', '2026-11-05T18:00:00', [['Bench', [[100, 10]]]]),
    S('c', '2026-11-09T18:00:00', [['Bench', [[105, 9]]]]),
  ]);
  const r = recentRecords(lifts, new Date('2026-11-10T12:00:00'));
  assert.deepEqual(r.map(x => [setLabel(x.point), setLabel(x.previous)]), [['105 lb × 9', '100 lb × 10'], ['100 lb × 10', '100 lb × 8']]);
});

test('weeks start on Monday', () => {
  assert.equal(weekStartOf(new Date('2026-11-22T10:00:00')).getDate(), 16); // Sunday -> previous Monday
  assert.equal(weekStartOf(new Date('2026-11-16T00:30:00')).getDate(), 16);
});
