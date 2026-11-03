import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTier } from '../app/lib/tierRules.ts';

test('only an exact pro value is pro', () => {
  assert.equal(normalizeTier('pro'), 'pro');
  for (const v of ['free', 'PRO', 'Pro', '', null, undefined, true, 1, {}, ['pro']]) assert.equal(normalizeTier(v), 'free');
});
