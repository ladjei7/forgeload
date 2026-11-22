import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStalled, progressed, workingSets, historyByExercise, type StallSession } from '../app/lib/stall.ts';

// sessions oldest first; each arg is one session as [weight, reps] pairs
const S = (...sets: [number, number][]): StallSession => ({ sets: sets.map(([weight, reps]) => ({ weight, reps })) });

test('double progression at one weight is progress: 10/9/8 -> 10/10/9 -> 10/10/10', () => {
  assert.equal(isStalled([S([100, 10], [100, 9], [100, 8]), S([100, 10], [100, 10], [100, 9]), S([100, 10], [100, 10], [100, 10])]), false);
});

test('a weight increase counts even with fewer reps: 100x12x3 -> 105x8x3 -> 105x9x3', () => {
  assert.equal(isStalled([S([100, 12], [100, 12], [100, 12]), S([105, 8], [105, 8], [105, 8]), S([105, 9], [105, 9], [105, 9])]), false);
});

test('10/10/9 three sessions in a row at the same weight is stalled', () => {
  const same = () => S([100, 10], [100, 10], [100, 9]);
  assert.equal(isStalled([same(), same(), same()]), true);
});

test('warm-up sets at lighter weights are ignored', () => {
  const s = (reps: number): StallSession => ({ sets: [{ weight: 45, reps: 10, set_type: 'warmup' }, { weight: 95, reps: 5, set_type: 'warmup' }, { weight: 135, reps }, { weight: 135, reps }] });
  assert.equal(progressed(s(8), s(9)), true);
  assert.deepEqual(workingSets(s(8).sets), [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }]);
  // more warm-ups with more reps do not make a stall look like progress
  const warm = (n: number): StallSession => ({ sets: [{ weight: 45, reps: n, set_type: 'warmup' }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }] });
  assert.equal(isStalled([warm(5), warm(10), warm(15)]), true);
});

test('3 sets one week, 2 the next, same reps on the shared sets: no false drop, and no false gain', () => {
  assert.equal(progressed(S([100, 10], [100, 9], [100, 8]), S([100, 10], [100, 9])), false); // not a gain
  assert.equal(progressed(S([100, 10], [100, 9]), S([100, 10], [100, 10], [100, 7])), true); // shared sets went up
  assert.equal(isStalled([S([100, 10], [100, 9], [100, 8]), S([100, 10], [100, 9]), S([100, 10], [100, 10], [100, 9])]), false);
});

test('a swapped exercise (different exercise_id) keeps its own history', () => {
  const day = (iso: string, id: string, reps: number) => ({ completed_at: iso, exercise_logs: [{ exercise_id: id, exercise_name: 'Row', exercise_sets: [{ weight: 100, reps }] }] });
  const h = historyByExercise([day('2026-11-01', 'barbell-row', 8), day('2026-11-03', 'cable-row', 12), day('2026-11-05', 'barbell-row', 8), day('2026-11-07', 'barbell-row', 8)]);
  assert.equal(h.get('barbell-row')!.length, 3);
  assert.equal(h.get('cable-row')!.length, 1);
  assert.equal(isStalled(h.get('barbell-row')!), true);
  assert.equal(isStalled(h.get('cable-row')!), false);
  // no id: falls back to the name
  const byName = historyByExercise([{ completed_at: '2026-11-01', exercise_logs: [{ exercise_name: ' Plank ', exercise_sets: [{ weight: 0, reps: 30 }] }] }]);
  assert.ok(byName.has('plank'));
});

test('bodyweight exercise with rising reps is not stalled; flat reps is', () => {
  assert.equal(isStalled([S([0, 6], [0, 5]), S([0, 7], [0, 5]), S([0, 7], [0, 6])]), false);
  assert.equal(isStalled([S([0, 6], [0, 5]), S([0, 6], [0, 5]), S([0, 6], [0, 5])]), true);
});

test('fewer than 3 eligible sessions is never stalled; empty and skipped-only sessions are not eligible', () => {
  assert.equal(isStalled([]), false);
  assert.equal(isStalled([S([100, 8]), S([100, 8])]), false);
  const skipped: StallSession = { sets: [{ weight: 100, reps: 8, skipped: true }] };
  assert.equal(isStalled([S([100, 8]), skipped, S([100, 8]), { sets: [] }]), false);
});

test('a session that improves resets the count; a drop in weight is not progress', () => {
  assert.equal(isStalled([S([100, 8]), S([100, 8]), S([100, 9]), S([100, 9])]), false); // only 1 flat step after the gain
  assert.equal(isStalled([S([100, 8]), S([100, 9]), S([100, 9]), S([100, 9])]), true);  // gain, then 3 flat sessions
  assert.equal(isStalled([S([100, 10]), S([95, 10]), S([95, 10])]), true);
});
