import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIB, PATTERN, levelOf, estMinutes, comfortLevel, type Comfort } from '../app/design-preview/data.ts';
import { generatePlan, MAJOR, MAJOR_MUSCLES } from '../app/design-preview/generate.ts';

const DAYS = [2, 3, 4, 5, 6], TIMES = [45, 60, 90], GOALS = ['muscle', 'strength', 'both'], EXPS = ['new', 'some', 'exp'];
const COMFORTS: Comfort[] = ['machines', 'mixed', 'all', 'unsure'];
const each = (fn: (a: { days: number; time: number; goal: string; exp: string; comfort: Comfort }, r: ReturnType<typeof generatePlan>) => void) => {
  for (const days of DAYS) for (const time of TIMES) for (const goal of GOALS) for (const exp of EXPS) for (const comfort of COMFORTS) fn({ days, time, goal, exp, comfort }, generatePlan({ days, time, goal, exp, comfort }));
};
const ex = (id: string) => LIB.find((e) => e.id === id)!;

test('every combination covers all main movement patterns across the week', () => {
  each((a, r) => { const got = new Set(r.days.flatMap((d) => d.ex.map((e) => PATTERN[e.exId]))); for (const p of MAJOR) assert.ok(got.has(p), `${JSON.stringify(a)} missing ${p}`); });
});
test('every combination gives each major muscle enough weekly sets', () => {
  each((a, r) => { for (const m of MAJOR_MUSCLES) assert.ok((r.coverage[m] ?? 0) >= (a.days >= 4 ? 6 : 3), `${JSON.stringify(a)} ${m}=${r.coverage[m]}`); });
});
test('comfort is respected: machines means no dumbbells or barbells', () => {
  each((a, r) => { if (a.comfort === 'machines') for (const d of r.days) for (const e of d.ex) assert.ok(levelOf(ex(e.exId)) === 1, `${e.exId}`); });
});
test('mixed and unsure never include barbells or pull-ups; only "all" can', () => {
  each((a, r) => { for (const d of r.days) for (const e of d.ex) { if (a.comfort !== 'all') { assert.notEqual(ex(e.exId).equip, 'Barbell', e.exId); assert.notEqual(e.exId, 'pullup'); } assert.ok(levelOf(ex(e.exId)) <= comfortLevel(a.comfort), e.exId); } });
});
test('unsure is treated exactly like machines and dumbbells', () => {
  for (const days of DAYS) assert.deepEqual(generatePlan({ days, time: 60, goal: 'both', exp: 'new', comfort: 'unsure' }).days, generatePlan({ days, time: 60, goal: 'both', exp: 'new', comfort: 'mixed' }).days);
});
test('the beginner machine example: machine chest press, not a barbell bench', () => {
  const ids = generatePlan({ days: 3, time: 60, goal: 'both', exp: 'new', comfort: 'machines' }).days.flatMap((d) => d.ex.map((e) => e.exId));
  assert.ok(ids.includes('chestpm')); assert.ok(!ids.includes('bench'));
  const free = generatePlan({ days: 3, time: 60, goal: 'both', exp: 'some', comfort: 'all' }).days.flatMap((d) => d.ex.map((e) => e.exId));
  assert.ok(free.includes('bench') && free.includes('squat'));
});
test('every workout fits the chosen time and has 3 to 8 exercises', () => {
  each((a, r) => { for (const d of r.days) { assert.ok(estMinutes(d.ex) <= a.time, `${JSON.stringify(a)} ${d.name}=${estMinutes(d.ex)}`); assert.ok(d.ex.length >= 3 && d.ex.length <= 8); } });
});
test('no exercise repeats inside one workout; ids unique; all exist', () => {
  each((a, r) => { const ids = new Set<string>(); for (const d of r.days) { const ex1 = d.ex.map((e) => e.exId); assert.equal(new Set(ex1).size, ex1.length); for (const e of d.ex) { assert.ok(!ids.has(e.id)); ids.add(e.id); assert.ok(LIB.some((l) => l.id === e.exId)); assert.ok(e.min >= 1 && e.max >= e.min); } } });
});
test('avoided exercises are never chosen and the pattern is still covered', () => {
  const avoid = ['chestpm', 'mrow', 'legpress'];
  for (const days of DAYS) { const r = generatePlan({ days, time: 60, goal: 'both', exp: 'some', comfort: 'machines', avoid }); const got = new Set(r.days.flatMap((d) => d.ex.map((e) => e.exId))); for (const a of avoid) assert.ok(!got.has(a), a); for (const p of MAJOR) assert.ok(r.days.some((d) => d.ex.some((e) => PATTERN[e.exId] === p)), `${days} ${p}`); }
});
test('upper days differ from each other (variety)', () => {
  const r = generatePlan({ days: 4, time: 60, goal: 'both', exp: 'some', comfort: 'mixed' });
  const a = r.days[0].ex.map((e) => e.exId), b = r.days[2].ex.map((e) => e.exId);
  assert.ok(a.some((x, i) => x !== b[i]));
  assert.notEqual(a[0], b[1] === undefined ? '' : b[1]);
});
test('every exercise has a plain-language reason', () => {
  each((a, r) => { for (const d of r.days) for (const e of d.ex) assert.ok((r.why[e.id] ?? '').length > 10, `${e.id}`); });
});
test('deterministic', () => {
  assert.deepEqual(generatePlan({ days: 5, time: 45, goal: 'muscle', exp: 'new', comfort: 'all' }), generatePlan({ days: 5, time: 45, goal: 'muscle', exp: 'new', comfort: 'all' }));
});
test('strength goal uses lower rep ranges on main lifts than muscle goal', () => {
  const g = (goal: string) => generatePlan({ days: 4, time: 60, goal, exp: 'some', comfort: 'all' }).days[0].ex[0];
  assert.ok(g('strength').max < g('muscle').max);
});
test('if every option for a main pattern is avoided, the plan says so instead of breaking comfort rules', () => {
  const r = generatePlan({ days: 3, time: 60, goal: 'both', exp: 'some', comfort: 'machines', avoid: ['legpress', 'hack'] });
  assert.ok(r.notes.some((n) => /squats and leg press/.test(n)));
  for (const d of r.days) for (const e of d.ex) assert.equal(levelOf(ex(e.exId)), 1);
});

test('a beginner asking for 6 days starts on a 4-day plan, with a note saying why', () => {
  for (const exp of ['new', 'brand_new']) {
    const r = generatePlan({ days: 6, exp, goal: 'muscle', time: 60, comfort: 'mixed' });
    assert.equal(r.days.length, 4, exp);
    assert.ok(r.notes.some(n => /started there/.test(n)), exp);
  }
  assert.equal(generatePlan({ days: 6, exp: 'exp', goal: 'muscle', time: 60, comfort: 'all' }).days.length, 6);
});
test('1 day a week still produces a full-body rotation', () => {
  const r = generatePlan({ days: 1, exp: 'brand_new', goal: 'fitness', time: 30, comfort: 'machines' });
  assert.ok(r.days.length >= 1 && r.days.every(d => d.ex.length >= 3));
});
