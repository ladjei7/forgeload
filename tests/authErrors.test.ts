import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyAuthError as f, readRecoveryHash } from '../app/lib/authErrors.ts';

test('the email rate limit gets a plain explanation', () => {
  assert.match(f({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 }), /try again in about an hour/);
  assert.match(f({ message: 'email rate limit exceeded' }), /about an hour/);
});
test('the per-request wait keeps the real number of seconds', () => {
  assert.equal(f({ message: 'For security purposes, you can only request this after 51 seconds.', code: 'over_email_send_rate_limit', status: 429 }), 'Please wait 51 seconds and try again.');
});
test('common sign-in and sign-up problems', () => {
  assert.equal(f({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }), 'Wrong email or password.');
  assert.match(f({ message: 'Email not confirmed', code: 'email_not_confirmed' }), /Confirm your email first/);
  assert.match(f({ message: 'User already registered', code: 'user_already_exists' }), /Sign in instead/);
  assert.match(f({ message: 'Password should be at least 6 characters.', code: 'weak_password' }), /at least 6/);
  assert.match(f({ message: 'Unable to validate email address: invalid format', code: 'email_address_invalid' }), /doesn't look right/);
  assert.match(f({ message: 'TypeError: Failed to fetch' }), /Check your connection/);
});
test('unknown errors still say something and keep the detail', () => {
  assert.match(f({ message: 'weird' }), /weird/);
  assert.equal(f(null), '');
});

test('password reset: reusing the old password and an expired session get plain wording', () => {
  assert.match(f({ message: 'New password should be different from the old password.', code: 'same_password', status: 422 }), /current password/);
  assert.match(f({ message: 'Auth session missing!', code: 'session_not_found' }), /expired/);
});
test('reset link hash: recovery detected, expired or broken links explained, anything else ignored', () => {
  assert.deepEqual(readRecoveryHash('#access_token=x&refresh_token=y&type=recovery'), { recovery: true, error: null });
  assert.match(readRecoveryHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid').error!, /expired or was already used/);
  assert.match(readRecoveryHash('#error=server_error').error!, /did not work/);
  assert.deepEqual(readRecoveryHash(''), { recovery: false, error: null });
  assert.deepEqual(readRecoveryHash('#access_token=x&type=signup'), { recovery: false, error: null });
});
