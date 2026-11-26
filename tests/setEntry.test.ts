// Item 2 of the production checklist: a suggested target is never silently recorded as performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEntry } from '../app/lib/setEntry.ts';

const base = { typedWeight: '', typedReps: '', targetWeight: 100, targetReps: 8, emptyWeightIsZero: false };

test('empty boxes resolve to the target but are flagged as a suggestion (needs an explicit yes)', () => {
  const e = resolveEntry(base);
  assert.deepEqual(e, { ok: true, weight: 100, reps: 8, suggested: true, suggestedParts: ['weight', 'reps'] });
});
test('typed numbers are performance, never a suggestion', () => {
  assert.deepEqual(resolveEntry({ ...base, typedWeight: '105', typedReps: '10' }), { ok: true, weight: 105, reps: 10, suggested: false, suggestedParts: [] });
});
test('beating the target is recorded as typed (targets are a minimum, not a cap)', () => {
  const e = resolveEntry({ ...base, typedWeight: '100', typedReps: '12' });
  assert.ok(e.ok && e.reps === 12 && !e.suggested);
});
test('one typed box and one empty box: still a suggestion for the empty part', () => {
  const e = resolveEntry({ ...base, typedWeight: '100' });
  assert.ok(e.ok && e.suggested); assert.deepEqual(e.ok && e.suggestedParts, ['reps']);
});
test('no target and no previous: nothing is invented, the person must type', () => {
  const e = resolveEntry({ ...base, targetWeight: null, targetReps: null });
  assert.deepEqual(e, { ok: false, missing: ['weight', 'reps'] });
});
test('"your call" days: last time\'s numbers can be offered, still as a suggestion', () => {
  const e = resolveEntry({ ...base, targetWeight: null, targetReps: null, prevWeight: 95, prevReps: 7 });
  assert.ok(e.ok && e.suggested && e.weight === 95 && e.reps === 7);
});
test('bodyweight: an empty weight box means no added weight, which is not a suggestion', () => {
  const e = resolveEntry({ ...base, targetWeight: 0, typedReps: '9', emptyWeightIsZero: true });
  assert.deepEqual(e, { ok: true, weight: 0, reps: 9, suggested: false, suggestedParts: [] });
});
test('bodyweight with an added-weight target: an empty box is the suggested added weight', () => {
  const e = resolveEntry({ ...base, targetWeight: 25, typedReps: '6', emptyWeightIsZero: true });
  assert.ok(e.ok && e.weight === 25 && e.suggested);
});
test('rubbish input is rejected, not guessed', () => {
  assert.deepEqual(resolveEntry({ ...base, typedWeight: 'abc', typedReps: '0' }), { ok: false, missing: ['weight', 'reps'] });
  assert.deepEqual(resolveEntry({ ...base, typedWeight: '-5' }), { ok: false, missing: ['weight'] });
});
