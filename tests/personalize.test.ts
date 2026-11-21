import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAreas, applyFocus } from '../app/lib/personalize.ts';
import { show, toLb, stepFor, guessUnit, fmt } from '../app/lib/units.ts';
import type { PlanTemplate } from '../app/lib/templates.ts';

const tpl: PlanTemplate = {
  id: 't', name: 'T', blurb: '', days: [
    { name: 'Upper', exercises: [['Barbell Bench Press', 3, 6, 10], ['Barbell Row', 3, 6, 10], ['Overhead Press', 3, 6, 10], ['Barbell Curl', 2, 8, 12], ['Skull Crusher', 2, 8, 12]] },
    { name: 'Lower', exercises: [['Barbell Back Squat', 3, 6, 10], ['Romanian Deadlift', 3, 6, 10], ['Leg Extension', 3, 10, 15]] },
  ],
} as PlanTemplate;
const names = (t: PlanTemplate, i: number) => t.days[i].exercises.map(e => e[0]);

test('no areas: plan unchanged, no notes', () => {
  const r = applyAreas(tpl, []); assert.equal(r.tpl, tpl); assert.deepEqual(r.notes, []);
});
test('shoulders: pressing moves to gentler options, sets and reps kept', () => {
  const r = applyAreas(tpl, ['shoulders']);
  assert.deepEqual(names(r.tpl, 0), ['Machine Chest Press', 'Barbell Row', 'Cable Lateral Raise', 'Barbell Curl', 'Skull Crusher']);
  assert.deepEqual(r.tpl.days[0].exercises[0].slice(1), [3, 6, 10]);
  assert.match(r.notes[0], /your shoulders/); assert.match(r.notes.at(-1)!, /isn't medical advice/);
});
test('knees and lower back: squats and hinges swapped; a replacement never loads a chosen area or duplicates', () => {
  const r = applyAreas(tpl, ['knees', 'lower_back']);
  assert.deepEqual(names(r.tpl, 1), ['Leg Press', 'Leg Curl', 'Leg Extension']);
  assert.equal(new Set(names(r.tpl, 1)).size, names(r.tpl, 1).length);
  assert.ok(!names(r.tpl, 0).includes('Barbell Row') && names(r.tpl, 0).includes('Chest-Supported Machine Row'));
});
test('a 3-exercise workout never loses an exercise; with nothing gentler left it is kept with a note', () => {
  const r = applyAreas(tpl, ['knees', 'lower_back']);
  assert.equal(r.tpl.days[1].exercises.length, 3); // Leg Extension had only Leg Curl, already used -> kept
  assert.ok(r.notes.some(n => /no gentler option/.test(n)));
});
test('wrists and elbows: curls and skull crushers swapped', () => {
  const r = applyAreas(tpl, ['wrists', 'elbows']);
  assert.ok(names(r.tpl, 0).includes('Hammer Curl') && names(r.tpl, 0).includes('Tricep Pushdown'));
});
test('focus: +1 set on matching exercises, max 2 per workout, max 5 sets, up to 2 focus areas', () => {
  const r = applyFocus(tpl, ['arms']);
  assert.deepEqual(r.tpl.days[0].exercises.map(e => e[1]), [3, 3, 3, 3, 3]);
  const legs = applyFocus(tpl, ['legs']);
  assert.deepEqual(legs.tpl.days[1].exercises.map(e => e[1]), [4, 4, 3]);
  assert.match(legs.notes[0], /legs and glutes/);
  assert.deepEqual(applyFocus(tpl, []).notes, []);
});
test('units: kg round-trips through stored pounds; steps; labels', () => {
  for (const kg of [20, 32.5, 60, 61.2, 100, 142.5]) assert.equal(show(toLb(kg, 'kg'), 'kg'), kg);
  assert.equal(toLb(135, 'lb'), 135); assert.equal(show(135, 'lb'), 135);
  assert.equal(show(135, 'kg'), 61.2);
  assert.equal(stepFor('kg'), 2.5); assert.equal(stepFor('lb'), 5);
  assert.equal(fmt(132.28, 'kg'), '60 kg');
});
test('units: suggested from the device language', () => {
  assert.equal(guessUnit('en-US'), 'lb'); assert.equal(guessUnit('en-GB'), 'kg'); assert.equal(guessUnit('fr-FR'), 'kg'); assert.equal(guessUnit(undefined), 'kg');
});
