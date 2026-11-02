import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, FEATURE_TIER, STATUS, type Feature } from '../app/design-preview/entitlements.ts';
import { suggest, PRO_KINDS } from '../app/design-preview/adapt.ts';
import { LIB, SEED_PLAN, SEED_HIST } from '../app/design-preview/data.ts';

const FREE_ALWAYS: Feature[] = ['log', 'history', 'export', 'delete-account', 'substitute', 'custom-exercise', 'comfort-prefs', 'preferred-exercises', 'starter-plan', 'targets', 'basic-suggestions'];
test('ownership, logging, exercise choice and basic guidance are free on every tier', () => {
  for (const f of FREE_ALWAYS) { assert.equal(FEATURE_TIER[f], 'free', f); assert.ok(can('free', f), f); }
});
test('Pro features need Pro; Pro includes everything', () => {
  for (const [f, t] of Object.entries(FEATURE_TIER) as [Feature, string][]) { assert.ok(can('pro', f)); if (t === 'pro') assert.equal(can('free', f), false, f); }
});
test('every Pro feature is marked prototype or planned, never silently live', () => {
  for (const [f, t] of Object.entries(FEATURE_TIER) as [Feature, string][]) if (t === 'pro') assert.ok(STATUS[f] === 'prototype' || STATUS[f] === 'planned', f);
});
test('suggestion tiers: only analysis kinds are Pro; saving swaps, not-for-me, comfort and preference offers are free', () => {
  const i = { plan: SEED_PLAN, hist: SEED_HIST, events: [{ k: 'swap' as const, from: 'row', to: 'cablerow', d: 1 }, { k: 'swap' as const, from: 'row', to: 'cablerow', d: 2 }, { k: 'swap' as const, from: 'row', to: 'cablerow', d: 3 }], dismissed: [], comfort: 'all' as const, avoid: [], planTime: 30, lib: LIB };
  const s = suggest(i);
  assert.ok(s.some((x) => x.tier === 'free' && x.kind === 'repeat-swap')); assert.ok(s.some((x) => x.tier === 'pro' && x.kind === 'stalled')); assert.ok(s.some((x) => x.tier === 'pro' && x.kind === 'time'));
  for (const x of s) assert.equal(x.tier === 'pro', PRO_KINDS.includes(x.kind));
});
test('seed demo: Free sees the repeat-swap suggestion; the plateau is Pro', () => {
  const s = suggest({ plan: SEED_PLAN, hist: SEED_HIST, events: [1, 2, 3].map((d) => ({ k: 'swap' as const, from: 'row', to: 'cablerow', d })), dismissed: [], comfort: 'all', avoid: [], planTime: 60, lib: LIB });
  assert.deepEqual(s.map((x) => [x.kind, x.tier]), [['repeat-swap', 'free'], ['stalled', 'pro']]);
});
