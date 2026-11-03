import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swapSuggestions, type EventRow, type PlanRow, type SwapEnd } from '../app/lib/swapSuggestions.ts';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 86400000).toISOString();
const A: SwapEnd = { id: 'a1', name: 'Barbell Row' }, B: SwapEnd = { id: 'b1', name: 'Seated Cable Row' };
const swap = (n: number, from: SwapEnd = A, to: SwapEnd = B): EventRow => ({ kind: 'swap', payload: { from, to }, created_at: day(n) });
const plan: PlanRow[] = [{ id: 'p1', workout_day_id: 'd1', exercise_id: 'a1', exercise_name: 'Barbell Row' }, { id: 'p2', workout_day_id: 'd2', exercise_id: 'a1', exercise_name: 'Barbell Row' }];
const sug = (id: string, action: string, n: number): EventRow => ({ kind: 'suggestion', payload: { sid: id, action }, created_at: day(n) });

test('three swaps in 30 days suggest making it the default, for every plan row that has the old exercise', () => {
  const s = swapSuggestions([swap(1), swap(5), swap(9)], plan, NOW);
  assert.equal(s.length, 1); assert.equal(s[0].count, 3); assert.deepEqual(s[0].rows.map(r => r.id), ['p1', 'p2']);
});
test('two swaps, or swaps older than 30 days, do not trigger it', () => {
  assert.equal(swapSuggestions([swap(1), swap(5)], plan, NOW).length, 0);
  assert.equal(swapSuggestions([swap(1), swap(5), swap(40)], plan, NOW).length, 0);
});
test('a workout that already contains the new exercise is left alone', () => {
  const p2: PlanRow[] = [...plan, { id: 'p3', workout_day_id: 'd1', exercise_id: 'b1', exercise_name: 'Seated Cable Row' }];
  assert.deepEqual(swapSuggestions([swap(1), swap(2), swap(3)], p2, NOW)[0].rows.map(r => r.id), ['p2']);
});
test('nothing is suggested when the old exercise is no longer in the plan', () => {
  assert.equal(swapSuggestions([swap(1), swap(2), swap(3)], [{ id: 'x', workout_day_id: 'd1', exercise_id: 'z', exercise_name: 'Other' }], NOW).length, 0);
});
test('dismissed or accepted hides it until three NEW swaps; undone brings it back', () => {
  const ev = [swap(1), swap(5), swap(9)]; const sid = 'a1>b1';
  assert.equal(swapSuggestions([...ev, sug(sid, 'dismissed', 0)], plan, NOW).length, 0);
  assert.equal(swapSuggestions([...ev, sug(sid, 'undone', 0.1), sug(sid, 'accepted', 0.2)], plan, NOW).length, 1);
  assert.equal(swapSuggestions([swap(0.1), swap(0.2), swap(0.3), ...ev, sug(sid, 'dismissed', 0.5)], plan, NOW).length, 1);
});
test('exercises without ids are matched by normalized name; different pairs are counted separately', () => {
  const n1: SwapEnd = { id: null, name: 'Pull Up' }, n2: SwapEnd = { id: null, name: 'Lat Pulldown' };
  const p: PlanRow[] = [{ id: 'q', workout_day_id: 'd1', exercise_id: null, exercise_name: 'pull-up' }];
  assert.equal(swapSuggestions([swap(1, n1, n2), swap(2, { id: null, name: 'Pull-Up' }, n2), swap(3, n1, n2)], p, NOW).length, 1);
  assert.equal(swapSuggestions([swap(1, A, B), swap(2, A, { id: 'c', name: 'Other' }), swap(3, A, B)], plan, NOW).length, 0);
});
