import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTarget, SEED_PLAN, SEED_HIST, LIB, estMinutes, totalSets, libOf, lastLine } from '../app/design-preview/data.ts';
import { generatePlan as gen } from '../app/design-preview/generate.ts';
const generatePlan = (n: number, m: number) => gen({ days: n, exp: 'some', goal: 'both', time: m, comfort: 'mixed' }).days;

const pe = (exId: string) => SEED_PLAN.flatMap((d) => d.ex).find((e) => e.exId === exId)!;
const T = (exId: string) => computeTarget(pe(exId), libOf(LIB, exId), SEED_HIST[exId]);

test('bench 8,8,7 holds weight and aims for 8', () => {
  const t = T('bench');
  assert.deepEqual([t.w, t.r, t.kind], [135, 8, 'hold']);
  assert.match(t.detail.join(' '), /8, 8, 7/);
});
test('row at top of range on every set goes up 5 lb and resets reps', () => {
  const t = T('row');
  assert.deepEqual([t.w, t.r, t.kind, t.delta], [120, 8, 'up', 5]);
});
test('ohp with a set under the minimum holds weight and rebuilds', () => {
  const t = T('ohp');
  assert.deepEqual([t.w, t.r, t.kind], [75, 6, 'rebuild']);
});
test('pull-up is reps only: beat best by one', () => {
  const t = T('pullup');
  assert.deepEqual([t.w, t.r, t.kind], [0, 9, 'bw']);
});
test('no history gives a suggested start, flagged as first', () => {
  const t = T('pulldown');
  assert.equal(t.kind, 'first');
  assert.equal(t.lastLine, 'No history yet');
});
test('rep target never exceeds the range', () => {
  for (const d of SEED_PLAN) for (const e of d.ex) { const t = T(e.exId); assert.ok(t.r <= e.max && t.r >= 1, e.exId); }
});
test('seed data: counts agree everywhere they are derived', () => {
  const ua = SEED_PLAN[0];
  assert.equal(ua.ex.length, 5);
  assert.equal(totalSets(ua.ex), 15);
  assert.equal(estMinutes(ua.ex), 40);
  assert.equal(lastLine(SEED_HIST.bench, 'weight'), '135 x 8, 8, 7');
});
test('rotation order matches history recency (last done day is the one before next)', () => {
  const ago = (i: number) => Math.min(...SEED_PLAN[i].ex.flatMap((e) => (SEED_HIST[e.exId]?.[0] ? [SEED_HIST[e.exId][0].daysAgo] : [])));
  assert.ok(ago(0) > ago(1) && ago(1) > ago(2) && ago(2) > ago(3));
});
test('every plan exercise exists in the library, for every generated plan', () => {
  for (const n of [2, 3, 4, 5, 6]) for (const m of [45, 60, 90]) for (const d of generatePlan(n, m)) for (const e of d.ex) assert.ok(LIB.some((x) => x.id === e.exId), `${n}/${m}/${e.exId}`);
});

test('generated workouts stay within the chosen session length', () => {
  for (const n of [2, 3, 4, 5, 6]) for (const m of [45, 60, 90]) for (const d of generatePlan(n, m)) assert.ok(estMinutes(d.ex) <= m, `${n}/${m}/${d.name}=${estMinutes(d.ex)}`);
});
