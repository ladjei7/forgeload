import test from 'node:test';
import assert from 'node:assert/strict';
import { lastSets, summarize, weekDots, weekStart, todayIndex } from '../app/lib/homeSummary.ts';

const H = (name: string, id: string | null, at: string, sets: [number, number][]) => ({ name, exerciseId: id, at, sets: sets.map(([weight, reps], i) => ({ set_number: i + 1, reps, weight })) });

test('no history means no last performance and a start target, nothing invented', () => {
  const [s] = summarize([{ name: 'Bench', exerciseId: 'b', sets: 3, repMin: 8, repMax: 12 }], []);
  assert.equal(s.last, null); assert.equal(s.target.action, 'start'); assert.equal(s.target.weight, null);
});
test('uses the most recent completed session, matched by id before name', () => {
  const hist = [H('Bench', 'b', '2026-10-01T10:00:00Z', [[100, 8]]), H('Bench', 'b', '2026-10-20T10:00:00Z', [[110, 8], [110, 7]]), H('Squat', 's', '2026-10-25T10:00:00Z', [[200, 5]])];
  assert.deepEqual(lastSets(hist, { name: 'Bench', exerciseId: 'b' }), [{ weight: 110, reps: 8 }, { weight: 110, reps: 7 }]);
});
test('a renamed exercise keeps its history through the id', () => {
  const hist = [H('Flat Bench', 'b', '2026-10-20T10:00:00Z', [[110, 8]])];
  assert.equal(lastSets(hist, { name: 'Bench Press', exerciseId: 'b' })?.[0].weight, 110);
});
test('different exercises never share history', () => {
  const hist = [H('Incline Press', 'i', '2026-10-20T10:00:00Z', [[90, 8]])];
  assert.equal(lastSets(hist, { name: 'Bench', exerciseId: 'b' }), null);
});
test('sessions with no reps are ignored', () => {
  assert.equal(lastSets([H('Bench', 'b', '2026-10-20T10:00:00Z', [[100, 0]])], { name: 'Bench', exerciseId: 'b' }), null);
});
test('target follows the progression rule from last time', () => {
  const [s] = summarize([{ name: 'Bench', exerciseId: 'b', sets: 2, repMin: 8, repMax: 12 }], [H('Bench', 'b', '2026-10-20T10:00:00Z', [[100, 12], [100, 12]])]);
  assert.equal(s.target.action, 'add_weight'); assert.equal(s.target.weight, 105);
});
test('week starts Monday and dots mark days with a workout', () => {
  const now = new Date(2026, 10, 4, 12); // Wed Nov 4 2026
  assert.equal(weekStart(now).getDay(), 1); assert.equal(todayIndex(now), 2);
  const dots = weekDots([new Date(2026, 10, 2, 18).toISOString(), new Date(2026, 10, 4, 7).toISOString(), new Date(2026, 9, 30, 9).toISOString()], now);
  assert.deepEqual(dots, [true, false, true, false, false, false, false]);
});
test('empty week is all false', () => assert.deepEqual(weekDots([], new Date(2026, 10, 4)), Array(7).fill(false)));
