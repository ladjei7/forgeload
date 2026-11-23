import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveItem, slotForY } from '../app/lib/reorder.ts';

test('moveItem: Leg Extension from 6th to 4th, the rest keep their order', () => {
  const day = ['Squat', 'RDL', 'Leg Press', 'Leg Curl', 'Calf Raise', 'Leg Extension'];
  assert.deepEqual(moveItem(day, 5, 3), ['Squat', 'RDL', 'Leg Press', 'Leg Extension', 'Leg Curl', 'Calf Raise']);
  assert.deepEqual(moveItem(day, 0, 5), ['RDL', 'Leg Press', 'Leg Curl', 'Calf Raise', 'Leg Extension', 'Squat']);
  assert.deepEqual(moveItem(day, 2, 2), day);
  assert.deepEqual(moveItem(day, 0, 9), day, 'out of range: unchanged');
  assert.notEqual(moveItem(day, 1, 1), day, 'always a new array');
});

test('slotForY: the row under the pointer, clamped to the list', () => {
  const rows = [{ top: 0, bottom: 60 }, { top: 60, bottom: 120 }, { top: 120, bottom: 180 }];
  assert.equal(slotForY(-50, rows), 0);
  assert.equal(slotForY(59, rows), 0);
  assert.equal(slotForY(60, rows), 1);
  assert.equal(slotForY(150, rows), 2);
  assert.equal(slotForY(999, rows), 2);
  assert.equal(slotForY(10, []), 0);
});
