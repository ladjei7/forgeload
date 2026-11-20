import { createClient } from '@supabase/supabase-js';
import { readRecoveryHash } from './authErrors';

// A password-reset link arrives as "...#access_token=...&type=recovery" (or "#error_code=otp_expired"
// when it has expired). The auth client reads and clears that part of the address as soon as it starts,
// so note it first. AuthGate then sends the person to /reset-password, even if Supabase sent them to
// the home page instead of the reset page.
export const RECOVERY_KEY = 'fl-recovery';
if (typeof window !== 'undefined') {
  const r = readRecoveryHash(window.location.hash);
  try {
    if (r.recovery) sessionStorage.setItem(RECOVERY_KEY, '1');
    else if (r.error) sessionStorage.setItem(RECOVERY_KEY, 'error:' + r.error);
  } catch { /* storage blocked: the reset page still works when the link lands on it directly */ }
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
