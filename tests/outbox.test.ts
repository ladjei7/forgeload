import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enqueue, flush, classify, overlay, load, save, withoutSession, type Op, type Outcome } from '../app/lib/outbox.ts';

const log = (id: string, s = 's1'): Op => ({ opId: 'o' + id, kind: 'log', sessionId: s, at: 1, payload: { id, workout_session_id: s, exercise_name: 'Bench ' + id, exercise_id: null, target_sets: 3, target_rep_min: 6, target_rep_max: 10 } });
const set = (id: string, logId = 'L1', reps = 8, s = 's1', idx = 0): Op => ({ opId: 'o' + id + reps, kind: 'set', sessionId: s, at: 1, peId: 'pe1', idx, payload: { id, exercise_log_id: logId, set_number: idx + 1, reps, weight: 135, completed: true } });
const del = (id: string, s = 's1'): Op => ({ opId: 'd' + id, kind: 'del', sessionId: s, at: 1, peId: 'pe1', idx: 0, setId: id });

test('a re-edit of the same set replaces the pending one (no duplicate writes)', () => {
  let q: Op[] = []; q = enqueue(q, log('L1')); q = enqueue(q, set('S1', 'L1', 8)); q = enqueue(q, set('S1', 'L1', 9));
  assert.equal(q.filter(o => o.kind === 'set').length, 1);
  assert.equal((q.at(-1) as Extract<Op, { kind: 'set' }>).payload.reps, 9);
});
test('the same log is never queued twice', () => {
  let q: Op[] = []; q = enqueue(q, log('L1')); q = enqueue(q, log('L1')); assert.equal(q.length, 1);
});
test('deleting a set replaces its pending write', () => {
  let q: Op[] = [set('S1')]; q = enqueue(q, del('S1')); assert.deepEqual(q.map(o => o.kind), ['del']);
});
test('offline: flush stops at the first network failure and keeps everything after it, in order', async () => {
  const q = [log('L1'), set('S1'), set('S2')];
  const r = await flush(q, async () => 'transient');
  assert.equal(r.confirmed.length, 0); assert.equal(r.stoppedOffline, true); assert.deepEqual(r.remaining.map(o => o.opId), q.map(o => o.opId));
});
test('back online: everything is sent once, in order, and the outbox empties', async () => {
  const sent: string[] = [];
  const r = await flush([log('L1'), set('S1'), set('S2')], async op => { sent.push(op.opId); return 'ok'; });
  assert.deepEqual(sent, ['oL1', 'oS18', 'oS28']); assert.equal(r.remaining.length, 0); assert.equal(r.confirmed.length, 3);
});
test('a thrown error counts as offline, not as success', async () => {
  const r = await flush([set('S1')], async () => { throw new Error('Failed to fetch'); });
  assert.equal(r.remaining.length, 1); assert.equal(r.confirmed.length, 0);
});
test('a rejected write stays in the outbox marked failed, and is not retried automatically', async () => {
  let calls = 0;
  const r1 = await flush([set('S1')], async () => { calls++; return 'permanent'; });
  assert.equal(r1.remaining[0].failed, 'rejected');
  await flush(r1.remaining, async () => { calls++; return 'ok'; });
  assert.equal(calls, 1, 'not resent without an explicit retry');
  const r3 = await flush(r1.remaining, async () => 'ok', { retryFailed: true });
  assert.equal(r3.remaining.length, 0);
});
test('if a log is rejected, its sets wait instead of failing one by one', async () => {
  const seen: string[] = [];
  const r = await flush([log('L1'), set('S1', 'L1')], async op => { seen.push(op.kind); return op.kind === 'log' ? 'permanent' : 'ok'; });
  assert.deepEqual(seen, ['log']); assert.equal(r.remaining.length, 2);
});
test('classify: network and overload retry; rejections do not', () => {
  const cases: [Parameters<typeof classify>, Outcome][] = [
    [[null, 201], 'ok'], [[{ message: 'TypeError: Failed to fetch' }, 0], 'transient'], [[{ message: 'x' }, undefined], 'transient'],
    [[{ message: 'x' }, 503], 'transient'], [[{ message: 'x' }, 429], 'transient'],
    [[{ message: 'new row violates row-level security policy', code: '42501' }, 403], 'permanent'], [[{ message: 'bad', code: '23514' }, 400], 'permanent'],
  ];
  for (const [args, want] of cases) assert.equal(classify(...args), want, JSON.stringify(args));
});
test('overlay rebuilds pending sets, deletes and log ids for one session after a refresh', () => {
  const q = [log('L1'), set('S1', 'L1'), { ...set('S2', 'L1', 8, 's1', 1), failed: 'rejected' } as Op, del('S9'), set('X', 'L2', 8, 'other')];
  const o = overlay(q, 's1');
  assert.equal(o.sets.length, 2); assert.equal(o.sets[1].failed, true); assert.ok(o.deleted.has('S9')); assert.equal(o.logIds['Bench L1'], 'L1');
});
test('storage: survives a save/load round trip; corrupt storage loads as empty instead of crashing', () => {
  let v: string | null = null; const store = { get: () => v, set: (x: string) => { v = x; } };
  assert.equal(save(store, [set('S1')]), true); assert.equal(load(store).length, 1);
  v = '{oops'; assert.deepEqual(load(store), []);
  assert.equal(save({ get: () => null, set: () => { throw new Error('quota'); } }, [set('S1')]), false);
});
test('discarding a workout removes only that workout\'s pending writes', () => {
  assert.deepEqual(withoutSession([set('A', 'L', 8, 's1'), set('B', 'L', 8, 's2')], 's1').map(o => o.sessionId), ['s2']);
});

const eff = (logId: string, effort: 'easy' | 'manageable' | 'very_hard' | 'unsure' | null, s = 's1'): Op => ({ opId: 'e' + logId + effort, kind: 'effort', sessionId: s, at: 1, logId, effort });
test('effort: a newer answer replaces the pending one; it is sent after its log, and waits if the log was rejected', async () => {
  let q: Op[] = []; q = enqueue(q, log('L1')); q = enqueue(q, eff('L1', 'easy')); q = enqueue(q, eff('L1', 'very_hard'));
  assert.deepEqual(q.map(o => o.kind), ['log', 'effort']);
  assert.equal((q[1] as Extract<Op, { kind: 'effort' }>).effort, 'very_hard');
  const seen: string[] = [];
  const r = await flush(q, async op => { seen.push(op.kind); return op.kind === 'log' ? 'permanent' : 'ok'; });
  assert.deepEqual(seen, ['log']); assert.equal(r.remaining.length, 2);
});
test('overlay restores pending effort answers after a refresh', () => {
  const o = overlay([log('L1'), eff('L1', 'manageable'), eff('L2', 'easy', 'other')], 's1');
  assert.deepEqual(o.efforts, { L1: 'manageable' });
});

test('deload flag: goes through the outbox, latest choice wins, and the overlay reports it', async () => {
  const { enqueue: enq, overlay: ov, flush: fl } = await import('../app/lib/outbox.ts');
  let ops = enq([], { opId: 'a', kind: 'deload', sessionId: 's1', at: 1, isDeload: true });
  ops = enq(ops, { opId: 'b', kind: 'deload', sessionId: 's1', at: 2, isDeload: false });
  ops = enq(ops, { opId: 'c', kind: 'deload', sessionId: 's2', at: 3, isDeload: true });
  assert.deepEqual(ops.map(o => o.opId), ['b', 'c']);
  assert.equal(ov(ops, 's1').deload, false);
  assert.equal(ov(ops, 's2').deload, true);
  assert.equal(ov([], 's1').deload, undefined); // nothing pending: use the server's value
  // offline: kept for later; online: sent and confirmed
  const off = await fl(ops, async () => 'transient');
  assert.equal(off.remaining.length, 2);
  const on = await fl(ops, async () => 'ok');
  assert.deepEqual([on.remaining.length, on.confirmed.length], [0, 2]);
});
