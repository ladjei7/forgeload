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

import { improvement, headline } from '../app/lib/progressStats.ts';
test('progress in plain words: +lb, +reps, and a headline sentence', () => {
  const lifts = liftProgress([
    S('a', '2026-11-02T18:00:00', [['Bench', [[135, 8]]], ['Row', [[100, 8]]], ['Pull Up', [[0, 5]]], ['Curl', [[30, 10]]]]),
    S('b', '2026-11-09T18:00:00', [['Bench', [[155, 8]]], ['Row', [[100, 11]]], ['Pull Up', [[0, 8]]], ['Curl', [[30, 9]]]]),
  ]);
  const by = (n: string) => lifts.find(l => l.name === n)!;
  assert.equal(improvement(by('Bench')), '+20 lb');
  assert.equal(improvement(by('Row')), '+3 reps');
  assert.equal(improvement(by('Pull Up')), '+3 reps');
  assert.equal(improvement(by('Curl')), null); // a dip is not shown as progress
  assert.equal(improvement(by('Bench'), 'kg'), '+9.1 kg');
  const s = summary([], lifts); s.workouts = 2;
  assert.equal(headline(lifts, s), "You're stronger on 3 of 4 lifts since you started.");
  assert.match(headline(lifts, { ...s, workouts: 1 }), /starting numbers/);
});

test('weight increases are marked on the chart and credited, even when the estimate dips', () => {
  const W = (id: string, iso: string, w: number, reps: number[], is_deload = false): PSession =>
    ({ id, completed_at: iso, is_deload, exercise_logs: [{ exercise_name: 'Row', exercise_id: 'row', exercise_sets: reps.map(r => ({ weight: w, reps: r })) }] });
  // 100 x 12 then 105 x 8: the estimate dips (140 -> 133) but the second point is a step up
  const [a] = liftProgress([W('1', '2026-11-02T18:00:00', 100, [12, 12, 12]), W('2', '2026-11-09T18:00:00', 105, [8, 8, 8])]);
  assert.ok(a.points[1].value < a.points[0].value);
  assert.deepEqual(a.points.map(p => p.weightUp), [false, true]);
  assert.equal(improvement(a), '+5 lb'); // not null, never "weaker"
  assert.match(headline([a], { workouts: 2, thisMonth: 2, weekStreak: 2, recordsLast30: 0 }), /stronger on 1 of 1/);
  // same weight with more reps: not a weight increase
  const [b] = liftProgress([W('1', '2026-11-02T18:00:00', 100, [10, 9, 8]), W('2', '2026-11-09T18:00:00', 100, [10, 10, 9])]);
  assert.deepEqual(b.points.map(p => p.weightUp), [false, false]);
  // working weight, not the best set: a heavy single first set does not count as moving up
  const heavy: PSession = { id: '2', completed_at: '2026-11-09T18:00:00', exercise_logs: [{ exercise_name: 'Row', exercise_id: 'row', exercise_sets: [{ weight: 110, reps: 6 }, { weight: 100, reps: 10 }, { weight: 100, reps: 10 }] }] };
  const [c] = liftProgress([W('1', '2026-11-02T18:00:00', 100, [10, 10]), heavy]);
  assert.equal(c.points[1].weightUp, false);
  // a deload in between: compared with the last non-deload workout
  const [d] = liftProgress([W('1', '2026-11-02T18:00:00', 100, [12, 12]), W('2', '2026-11-09T18:00:00', 80, [8, 8], true), W('3', '2026-11-16T18:00:00', 105, [8, 8])]);
  assert.deepEqual(d.points.map(p => [p.deload, p.weightUp]), [[false, false], [true, false], [false, true]]);
  const [e] = liftProgress([W('1', '2026-11-02T18:00:00', 100, [12, 12]), W('2', '2026-11-09T18:00:00', 80, [8, 8], true), W('3', '2026-11-16T18:00:00', 100, [12, 12])]);
  assert.equal(e.points[2].weightUp, false); // back at 100 after an 80 deload is not "moving up"
});
