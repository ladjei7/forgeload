import { supabase } from './supabase';

/** Sends the reset email. The link opens /reset-password on whichever site the request came from. */
export function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
}

// Same wording whether or not an account exists, so nobody can use this to find out who has an account.
export const RESET_SENT = "If there's an account for that email, we've sent a link to reset your password. It can take a minute; check your spam folder too.";
