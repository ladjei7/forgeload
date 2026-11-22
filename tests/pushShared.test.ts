import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the push function uses exactly the app\'s rules (run scripts/sync-push-shared.sh after changing them)', () => {
  for (const f of ['reminders', 'schedule', 'rotation', 'rules']) {
    assert.equal(readFileSync(`supabase/functions/push/shared/${f}.ts`, 'utf8'), readFileSync(`app/lib/${f}.ts`, 'utf8'), `${f}.ts drifted`);
  }
});
