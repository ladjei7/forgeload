import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestTarget, defaultRestSeconds, roundToIncrement } from '../app/lib/progression.ts';
import { nextDayId } from '../app/lib/rotation.ts';
import { localDateString, parseLocalDate } from '../app/lib/dates.ts';

const sets = (...pairs: [number, number][]) => pairs.map(([weight, reps]) => ({ weight, reps }));

test('no history -> start, no weight suggested', () => {
  const t = suggestTarget([], 8, 10);
  assert.equal(t.action, 'start');
  assert.equal(t.weight, null);
  assert.equal(t.reps, 8);
});

test('all sets at top of range -> add weight, reset to bottom of range', () => {
  const t = suggestTarget(sets([70, 10], [70, 10], [70, 10]), 8, 10);
  assert.equal(t.action, 'add_weight');
  assert.equal(t.weight, 75);
  assert.equal(t.reps, 8);
});

test('does not add weight because ONE set hit the top (10, 9, 8 at 70)', () => {
  const t = suggestTarget(sets([70, 10], [70, 9], [70, 8]), 8, 10);
  assert.equal(t.action, 'add_reps');
  assert.equal(t.weight, 70);
  assert.equal(t.reps, 9); // lowest set 8 -> aim for 9
});

test('below the minimum -> hold weight, never auto-increase or silently reduce', () => {
  const t = suggestTarget(sets([100, 6], [100, 5], [100, 5]), 8, 10);
  assert.equal(t.action, 'hold');
  assert.equal(t.weight, 100);
});

test('warm-up / lighter sets do not decide progression', () => {
  const t = suggestTarget(sets([45, 15], [135, 10], [135, 10]), 8, 10);
  assert.equal(t.action, 'add_weight');
  assert.equal(t.weight, 140);
});

test('custom increment is respected', () => {
  const t = suggestTarget(sets([20, 12], [20, 12]), 8, 12, 2.5);
  assert.equal(t.weight, 22.5);
});

test('bodyweight at top of range suggests adding load, no fake number', () => {
  const t = suggestTarget(sets([0, 12], [0, 12]), 8, 12);
  assert.equal(t.action, 'add_weight');
  assert.equal(t.weight, null);
});

test('invalid rows (0 reps) are ignored', () => {
  assert.equal(suggestTarget(sets([100, 0]), 8, 10).action, 'start');
});

test('rest defaults scale with rep range', () => {
  assert.equal(defaultRestSeconds(5), 180);
  assert.equal(defaultRestSeconds(10), 120);
  assert.equal(defaultRestSeconds(15), 90);
});

test('roundToIncrement', () => {
  assert.equal(roundToIncrement(72.4, 2.5), 72.5);
});

const days = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('rotation: first workout when nothing completed', () => {
  assert.equal(nextDayId(days, null), 'a');
});

test('rotation: advances by session, wraps around', () => {
  assert.equal(nextDayId(days, 'a'), 'b');
  assert.equal(nextDayId(days, 'c'), 'a');
});

test('rotation: a missed day does not skip a workout (same result any weekday)', () => {
  // The function has no date input at all, so a missed Wednesday cannot skip anything.
  assert.equal(nextDayId(days, 'b'), 'c');
});

test('rotation: deleted last day restarts from the top; empty plan -> null', () => {
  assert.equal(nextDayId(days, 'zzz'), 'a');
  assert.equal(nextDayId([], 'a'), null);
});

test('rotation: skips days that have no exercises (the "stuck on an empty Tuesday" bug)', () => {
  const week = [{ id: 'mon' }, { id: 'tue' }, { id: 'wed' }];
  const has = (id: string) => id !== 'tue';
  assert.equal(nextDayId(week, 'mon', has), 'wed'); // Tuesday is empty -> Wednesday
  assert.equal(nextDayId(week, 'wed', has), 'mon'); // wraps, still skipping Tuesday
  assert.equal(nextDayId(week, null, has), 'mon');
});

test('rotation: only one startable day -> it repeats; nothing startable -> plain rotation', () => {
  const week = [{ id: 'mon' }, { id: 'tue' }];
  assert.equal(nextDayId(week, 'mon', id => id === 'mon'), 'mon');
  assert.equal(nextDayId(week, 'mon', () => false), 'tue');
});

test('local dates are not shifted by UTC', () => {
  const evening = new Date(2026, 10, 1, 22, 30); // Nov 1, 10:30 PM local
  assert.equal(localDateString(evening), '2026-11-01');
  const parsed = parseLocalDate('2026-11-02');
  assert.equal(parsed.getDate(), 2);
  assert.equal(parsed.getMonth(), 10);
});

import { recommendPlan } from '../app/lib/recommend.ts';
import { TEMPLATES } from '../app/lib/templates.ts';

test('recommendation: every pick is a real template, for every answer', () => {
  const ids = new Set(TEMPLATES.map(t => t.id));
  for (const d of [1, 2, 3, 4, 5, 6, 7])
    for (const x of ['new', 'some', 'experienced'] as const) {
      const r = recommendPlan(d, x);
      assert.ok(ids.has(r.primary), `${d} ${x}`);
      for (const a of r.alternatives) assert.ok(ids.has(a));
      assert.ok(!r.alternatives.includes(r.primary));
      assert.ok(r.why.length > 20);
    }
});
test('recommendation: days per week drive the split', () => {
  assert.equal(recommendPlan(3, 'some').primary, 'fbeod');
  assert.equal(recommendPlan(2, 'new').primary, 'fbeod');
  assert.equal(recommendPlan(4, 'some').primary, 'ul2');
  assert.equal(recommendPlan(5, 'experienced').primary, 'ppl-ul');
  assert.equal(recommendPlan(6, 'experienced').primary, 'ppl');
});
test('recommendation: new lifters are not pushed to 5-6 days, but can still pick them', () => {
  assert.equal(recommendPlan(6, 'new').primary, 'ul2');
  assert.deepEqual(recommendPlan(6, 'new').alternatives, ['ppl']);
  assert.equal(recommendPlan(5, 'new').primary, 'ul2');
  assert.deepEqual(recommendPlan(5, 'new').alternatives, ['ppl-ul']);
});

import { tailorTemplate } from '../app/lib/recommend.ts';
test('tailoring: goal and session length change reps and exercise count, never the original', () => {
  const base = TEMPLATES.find(t => t.id === 'ul2')!;
  const firstBefore = JSON.stringify(base.days[0].exercises);
  const s = tailorTemplate(base, 'strength', 45);
  assert.equal(s.days[0].exercises.length, 4);
  assert.deepEqual([s.days[0].exercises[0][2], s.days[0].exercises[0][3]], [4, 6]);
  assert.deepEqual([s.days[0].exercises[1][2], s.days[0].exercises[1][3]], [4, 6]);
  assert.equal(s.days[0].exercises[2][2], base.days[0].exercises[2][2]);
  const b = tailorTemplate(base, 'both', 90);
  assert.deepEqual([b.days[0].exercises[0][2], b.days[0].exercises[0][3]], [5, 8]);
  assert.equal(b.days[0].exercises.length, base.days[0].exercises.length);
  const m = tailorTemplate(base, 'muscle', 60);
  assert.deepEqual(m.days, base.days);
  assert.equal(JSON.stringify(base.days[0].exercises), firstBefore);
  for (const d of s.days) for (const e of d.exercises) assert.ok(e[2] <= e[3] && e[1] >= 1);
});

test('onboarding v2: 1 day, brand new, new goals and session lengths', async () => {
  const { recommendPlan, tailorTemplate } = await import('../app/lib/recommend.ts');
  assert.equal(recommendPlan(1, 'brand_new').primary, 'fbeod');
  assert.equal(recommendPlan(6, 'brand_new').primary, 'ul2', 'a brand-new lifter picking 6 days is not handed 6 hard sessions');
  assert.equal(recommendPlan(5, 'brand_new').primary, 'ul2');
  const tpl = { id: 't', name: 'T', description: '', days: [{ name: 'A', exercises: [['Squat', 3, 5, 8], ['Row', 3, 8, 12], ['Press', 3, 8, 12], ['Curl', 3, 10, 15], ['Calf', 3, 10, 15], ['Abs', 3, 10, 15]] }] } as never;
  const short = tailorTemplate(tpl, 'muscle', 25); assert.equal((short as { days: { exercises: unknown[] }[] }).days[0].exercises.length, 3);
  const std = tailorTemplate(tpl, 'muscle', 55); assert.equal((std as { days: { exercises: unknown[] }[] }).days[0].exercises.length, 6, '45-60 min keeps the full plan');
  const fit = tailorTemplate(tpl, 'fitness', 75) as { days: { exercises: [string, number, number, number][] }[] };
  assert.ok(fit.days[0].exercises.every(e => e[2] >= 8 && e[3] > e[2]), 'general fitness uses 8+ reps');
  const fat = tailorTemplate(tpl, 'fat_loss', 75) as { days: { exercises: [string, number, number, number][] }[] };
  assert.deepEqual(fat.days[0].exercises[0], ['Squat', 3, 5, 8], 'fat loss keeps the muscle-building rep ranges');
});
