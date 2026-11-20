'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, RECOVERY_KEY } from '../lib/supabase';
import { friendlyAuthError } from '../lib/authErrors';
import { requestPasswordReset, RESET_SENT } from '../lib/passwordReset';
import { ui } from '../components/ui';

// Opened from the reset email. The link signs the person in for this one purpose, so they can
// choose a new password. Without a valid link they can ask for a new one here.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'set' | 'request' | 'done'>('checking');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let flag: string | null = null;
    try { flag = sessionStorage.getItem(RECOVERY_KEY); sessionStorage.removeItem(RECOVERY_KEY); } catch { /* storage blocked */ }
    const expired = flag?.startsWith('error:') ? flag.slice(6) : null;
    // The auth client may still be reading the link; wait for it before deciding.
    let settled = false;
    const decide = (signedIn: boolean) => {
      if (settled) return;
      settled = true;
      if (expired) { setLinkError(expired); setState('request'); } else setState(signedIn ? 'set' : 'request');
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) decide(true);
      else if (event === 'INITIAL_SESSION') decide(false);
    });
    supabase.auth.getSession().then(({ data }) => decide(!!data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw.length < 6) return setMsg({ kind: 'error', text: 'Use a password with at least 6 characters.' });
    if (pw !== pw2) return setMsg({ kind: 'error', text: "The two passwords don't match." });
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ kind: 'error', text: friendlyAuthError(error) });
    setState('done');
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) return setMsg({ kind: 'error', text: 'Enter the email you signed up with.' });
    setBusy(true); setMsg(null);
    const { error } = await requestPasswordReset(email);
    setBusy(false);
    setMsg(error ? { kind: 'error', text: friendlyAuthError(error) } : { kind: 'ok', text: RESET_SENT });
  }

  const note = msg && (
    <p role={msg.kind === 'error' ? 'alert' : 'status'}
      className={`mt-4 rounded-xl border bg-fl-s1 p-3 text-sm leading-relaxed ${msg.kind === 'error' ? 'border-fl-bad text-fl-bad' : 'border-fl-ok text-fl-ok'}`}>
      {msg.kind === 'error' ? '⚠ ' : '✓ '}{msg.text}
    </p>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10 text-fl-tx">
      {state === 'checking' && <p className="text-fl-tx2">Checking your link…</p>}

      {state === 'set' && (
        <>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mb-6 mt-1 text-fl-tx2">At least 6 characters. You&apos;ll stay signed in on this device.</p>
          <form onSubmit={save} noValidate className="space-y-3">
            <label className="block">
              <span className={ui.label}>New password</span>
              <input className={ui.input} type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
            </label>
            <label className="block">
              <span className={ui.label}>Type it again</span>
              <input className={ui.input} type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
            </label>
            <button type="submit" disabled={busy} aria-busy={busy} className={`${ui.primary} !mt-5 h-14 text-lg`}>{busy ? 'Saving…' : 'Save new password'}</button>
          </form>
          {note}
        </>
      )}

      {state === 'done' && (
        <>
          <h1 className="text-2xl font-bold">Password updated</h1>
          <p className="mb-6 mt-1 text-fl-tx2">Use your new password next time you sign in.</p>
          <button onClick={() => router.replace('/')} className={`${ui.primary} h-14 text-lg`}>Go to Forgeload</button>
        </>
      )}

      {state === 'request' && (
        <>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          {linkError
            ? <p role="alert" className="mb-6 mt-2 rounded-xl border border-fl-bad bg-fl-s1 p-3 text-sm text-fl-bad">⚠ {linkError}</p>
            : <p className="mb-6 mt-1 text-fl-tx2">Enter your email and we&apos;ll send you a link to choose a new password.</p>}
          <form onSubmit={sendLink} noValidate className="space-y-3">
            <label className="block">
              <span className={ui.label}>Email</span>
              <input className={ui.input} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <button type="submit" disabled={busy} aria-busy={busy} className={`${ui.primary} !mt-5 h-14 text-lg`}>{busy ? 'Sending…' : 'Send reset link'}</button>
          </form>
          {note}
          <Link href="/login" className="mt-3 flex h-12 items-center justify-center text-fl-tx2">Back to sign in</Link>
        </>
      )}
    </main>
  );
}
