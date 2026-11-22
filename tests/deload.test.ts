import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekEnd, deloadByDefault } from '../app/lib/deload.ts';
import { latestForTarget, suggestTarget } from '../app/lib/progression.ts';
import { lastSets, type HistEntry } from '../app/lib/homeSummary.ts';
import { liftProgress, recentRecords, summary, type PSession } from '../app/lib/progressStats.ts';

test('after a deload, next target builds on the last NON-deload session', () => {
  const hist: HistEntry[] = [
    { name: 'Bench', exerciseId: 'b', at: '2026-11-02T18:00:00Z', sets: [1, 2, 3].map(n => ({ set_number: n, weight: 185, reps: n === 3 ? 9 : 10 })) },
    { name: 'Bench', exerciseId: 'b', at: '2026-11-09T18:00:00Z', is_deload: true, sets: [1, 2].map(n => ({ set_number: n, weight: 185, reps: 7 })) },
  ];
  const last = lastSets(hist, { name: 'Bench', exerciseId: 'b' })!;
  assert.deepEqual(last.map(s => s.reps), [10, 10, 9]); // not the deload's 7, 7
  const t = suggestTarget(last, 8, 10, 5);
  assert.deepEqual([t.action, t.weight, t.reps], ['add_reps', 185, 10]);
  // the generic picker agrees; missing/null flags are normal sessions
  assert.equal(latestForTarget([{ at: '1', sets: [{ reps: 5 }] }, { at: '2', is_deload: null, sets: [{ reps: 6 }] }])!.at, '2');
  assert.equal(latestForTarget([{ at: '1', sets: [{ reps: 5 }] }, { at: '2', is_deload: true, sets: [{ reps: 6 }] }])!.at, '1');
  assert.equal(latestForTarget([{ at: '2', is_deload: true, sets: [{ reps: 6 }] }]), undefined); // only deloads: treat as first time
});

test('a deload session with lower numbers is never a record and never lowers anything', () => {
  const S = (id: string, iso: string, w: number, r: number, is_deload = false): PSession =>
    ({ id, completed_at: iso, is_deload, exercise_logs: [{ exercise_name: 'Squat', exercise_id: 'sq', exercise_sets: [{ weight: w, reps: r }] }] });
  const sessions = [S('a', '2026-11-02T18:00:00', 200, 8), S('b', '2026-11-09T18:00:00', 200, 5, true), S('c', '2026-11-16T18:00:00', 200, 9)];
  const [l] = liftProgress(sessions);
  assert.deepEqual(l.points.map(p => [p.deload, p.record]), [[false, false], [true, false], [false, true]]);
  assert.deepEqual([l.first.sessionId, l.best.sessionId], ['a', 'c']);
  const r = recentRecords([l], new Date('2026-11-17T12:00:00'));
  assert.equal(r[0].previous.sessionId, 'a'); // compared with the real best, not the deload
  // a deload that happens to be heavier is still not a record or a best
  const [l2] = liftProgress([S('a', '2026-11-02T18:00:00', 200, 8), S('b', '2026-11-09T18:00:00', 220, 8, true)]);
  assert.deepEqual([l2.points[1].record, l2.best.sessionId], [false, 'a']);
  // deloads still count as training
  assert.equal(summary(sessions, [l], new Date('2026-11-17T09:00:00')).workouts, 3);
});

test('rest of this week as deload: covers today through Sunday only', () => {
  assert.equal(weekEnd('2026-11-25'), '2026-11-29'); // Wednesday -> Sunday
  assert.equal(weekEnd('2026-11-29'), '2026-11-29');
  const until = weekEnd('2026-11-25');
  assert.equal(deloadByDefault(until, '2026-11-27'), true);
  assert.equal(deloadByDefault(until, '2026-11-30'), false); // next Monday
  assert.equal(deloadByDefault(null, '2026-11-27'), false);
  assert.equal(deloadByDefault('junk', '2026-11-27'), false);
});
