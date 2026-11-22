'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ui } from '../components/ui';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { friendlyAuthError } from '../lib/authErrors';
import { requestPasswordReset, RESET_SENT } from '../lib/passwordReset';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return; // one request at a time; a double tap must not trip the rate limit
    setMessage(null); setBusy(true);
    try {
      const addr = email.trim();
      if (mode === 'forgot') {
        if (!addr) { setMessage({ kind: 'error', text: 'Enter the email you signed up with.' }); return; }
        const { error } = await requestPasswordReset(addr);
        setMessage(error ? { kind: 'error', text: friendlyAuthError(error) } : { kind: 'ok', text: RESET_SENT });
        return;
      }
      const { data, error } =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email: addr, password })
          : await supabase.auth.signUp({ email: addr, password, options: { emailRedirectTo: window.location.origin } });
      if (error) { setMessage({ kind: 'error', text: friendlyAuthError(error) }); return; }
      if (mode === 'signup' && !data.session) {
        setMessage({ kind: 'ok', text: 'Check your email to confirm your account, then sign in.' });
        return;
      }
      router.push('/');
    } catch (err) {
      setMessage({ kind: 'error', text: friendlyAuthError(err as { message?: string }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10 text-fl-tx">
      <h1 className="mb-6">
        <Image src="/logo.png" alt="Forgeload" width={640} height={456} priority className="fl-logo-dark mx-auto block h-auto w-[70%] max-w-[260px]" />
        <Image src="/logo-light.png" alt="Forgeload" width={640} height={456} className="fl-logo-light mx-auto block h-auto w-[70%] max-w-[260px]" />
      </h1>
      {(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes('lwngtnwpycohbqimwqoh') && (
        <p className="mb-3 self-start rounded-full bg-fl-tint px-3 py-1 text-xs font-bold">Test database: make a new account here</p>
      )}
      <h2 className="text-2xl font-bold">{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
      <p className="mb-6 mt-1 text-fl-tx2">{mode === 'signin' ? 'Sign in to pick up where you left off.' : mode === 'signup' ? 'Free. Your plan and every set you log, saved to your account.' : "Enter your email and we'll send you a link to choose a new password."}</p>
      <form onSubmit={submit} noValidate className="space-y-3">
        <label className="block">
          <span className={ui.label}>Email</span>
          <input className={ui.input} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <label className="block">
            <span className={ui.label}>Password{mode === 'signup' ? ' (6 or more characters)' : ''}</span>
            <input className={ui.input} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />
          </label>
        )}
        {mode === 'signin' && (
          <div className="-mt-1 text-right">
            <button type="button" onClick={() => { setMode('forgot'); setMessage(null); }} className={`${ui.textBtn} -mr-2`}>Forgot password?</button>
          </div>
        )}
        <button type="submit" disabled={busy} aria-busy={busy} className={`${ui.primary} !mt-5 h-14 text-lg`}>
          {busy ? (mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending…') : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
      </form>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded-xl border bg-fl-s1 p-3 text-sm leading-relaxed ${message.kind === 'error' ? 'border-fl-bad text-fl-bad' : 'border-fl-ok text-fl-ok'}`}>
          {message.kind === 'error' ? '⚠ ' : '✓ '}{message.text}
        </p>
      )}
      <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null); }}
        className="mt-3 h-12 w-full text-center text-fl-tx2">
        {mode === 'signin' ? <>No account? <span className="font-semibold text-fl-tx">Sign up</span></>
          : mode === 'signup' ? <>Have an account? <span className="font-semibold text-fl-tx">Sign in</span></>
          : <>Remembered it? <span className="font-semibold text-fl-tx">Back to sign in</span></>}
      </button>
    </main>
  );
}
