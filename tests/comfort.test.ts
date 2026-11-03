import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../app/lib/templates.ts';
import { applyComfort, comfortLevel, LEVEL, type Comfort } from '../app/lib/comfort.ts';

const ALL: Comfort[] = ['machines', 'mixed', 'all', 'unsure'];
test('every exercise name used by every template, and every replacement, has a known level', () => {
  for (const t of TEMPLATES) for (const d of t.days) for (const e of d.exercises) assert.ok(LEVEL[e[0]], e[0]);
  for (const t of TEMPLATES) for (const c of ALL) for (const d of applyComfort(t, c).tpl.days) for (const e of d.exercises) assert.ok(LEVEL[e[0]], e[0]);
});
test('every plan respects the comfort level', () => {
  for (const t of TEMPLATES) for (const c of ALL) { const { tpl, notes } = applyComfort(t, c);
    for (const d of tpl.days) for (const e of d.exercises) assert.ok(LEVEL[e[0]] <= comfortLevel(c) || notes.some(n => /no easier version/.test(n)), `${t.id} ${c} ${e[0]}`); }
});
test('machines: machine chest press instead of barbell bench; all: barbell kept; unsure equals mixed', () => {
  const t = TEMPLATES.find(x => x.days.some(d => d.exercises.some(e => e[0] === 'Barbell Bench Press')))!;
  const names = (c: Comfort) => applyComfort(t, c).tpl.days.flatMap(d => d.exercises.map(e => e[0]));
  assert.ok(names('machines').includes('Machine Chest Press') && !names('machines').includes('Barbell Bench Press'));
  assert.ok(names('mixed').includes('Dumbbell Bench Press') && !names('mixed').some(n => LEVEL[n] === 3));
  assert.deepEqual(applyComfort(t, 'all').tpl, t);
  assert.deepEqual(applyComfort(t, 'unsure').tpl, applyComfort(t, 'mixed').tpl);
});
test('no duplicate exercise inside a workout; sets and rep ranges carry over; no workout shrinks below 3', () => {
  for (const t of TEMPLATES) for (const c of ALL) { const r = applyComfort(t, c);
    r.tpl.days.forEach((d, i) => { const n = d.exercises.map(e => e[0]); assert.equal(new Set(n).size, n.length, `${t.id} ${c} ${d.name}`); assert.ok(d.exercises.length >= Math.min(3, t.days[i].exercises.length)); });
    if (c === 'machines') { const o = t.days[0].exercises[0]; const x = r.tpl.days[0].exercises[0]; assert.deepEqual(x.slice(1), o.slice(1)); } }
});
test('swapped map says what each replacement stands in for', () => {
  const t = TEMPLATES[0]; const r = applyComfort(t, 'machines');
  for (const [n, o] of Object.entries(r.swapped)) { assert.ok(LEVEL[n] < LEVEL[o]); }
});
