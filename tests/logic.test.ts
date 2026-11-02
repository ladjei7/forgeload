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
