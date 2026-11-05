import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCurrent } from '../app/lib/pickCurrent.ts';

const P = (id: string, is_active: boolean | null = true) => ({ id, name: id, is_active });

test('no plans: nothing is current', () => { assert.equal(pickCurrent([], 'a'), undefined); });
test('this device\'s choice wins while it is still active', () => {
  assert.equal(pickCurrent([P('a'), P('b')], 'a')?.id, 'a');
});
test('switched on another device: this device follows the account, not its stale choice', () => {
  assert.equal(pickCurrent([P('old', false), P('new', true)], 'old')?.id, 'new');
});
test('switching back to an older plan works (newest is not forced)', () => {
  assert.equal(pickCurrent([P('a', true), P('b', false)], null)?.id, 'a');
});
test('existing accounts (every plan active, or unset) keep today\'s behaviour: newest plan', () => {
  assert.equal(pickCurrent([P('a'), P('b')], null)?.id, 'b');
  assert.equal(pickCurrent([P('a', null), P('b', null)], 'zzz')?.id, 'b');
});
test('if every plan is marked inactive, fall back to the newest instead of showing nothing', () => {
  assert.equal(pickCurrent([P('a', false), P('b', false)], 'a')?.id, 'b');
});
