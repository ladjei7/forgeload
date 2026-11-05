// Plain-language versions of Supabase auth errors. Pure function so it is unit tested.
export function friendlyAuthError(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!err) return '';
  const msg = err.message ?? '';
  const code = err.code ?? '';
  const wait = /after (\d+) seconds?/i.exec(msg);
  if (wait) return `Please wait ${wait[1]} seconds and try again.`;
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg))
    return "We couldn't send your confirmation email because too many people signed up in the last hour. Please try again in about an hour.";
  if (code === 'over_request_rate_limit' || err.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'There is already an account with this email. Sign in instead.';
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'Use a password with at least 6 characters.';
  if (code === 'email_address_invalid' || /invalid format|unable to validate email|invalid email/i.test(msg)) return "That email address doesn't look right.";
  if (/fetch|network/i.test(msg)) return "Can't reach Forgeload. Check your connection and try again.";
  return `Something went wrong (${msg || 'unknown error'}). Please try again.`;
}
