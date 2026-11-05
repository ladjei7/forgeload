'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { friendlyAuthError } from '../lib/authErrors';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return; // one request at a time; a double tap must not trip the rate limit
    setMessage(null); setBusy(true);
    try {
      const addr = email.trim();
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

  const input = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--fl-line)', background: 'var(--fl-s2)', color: 'var(--fl-tx)', fontSize: '16px', marginBottom: '0.75rem', boxSizing: 'border-box' as const };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--fl-bg)', color: 'var(--fl-tx)', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 1.25rem' }}>
        <Image src="/logo.png" alt="Forgeload" width={640} height={456} priority style={{ width: '70%', maxWidth: 260, height: 'auto', display: 'block', margin: '0 auto' }} />
      </h1>
      <p style={{ color: 'var(--fl-tx2)', marginBottom: '2rem' }}>{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>
      <form onSubmit={submit} noValidate>
        <input style={input} type="email" placeholder="Email" autoComplete="email" inputMode="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={input} type="password" placeholder="Password (6+ characters)" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit" disabled={busy} aria-busy={busy} style={{ width: '100%', padding: '0.75rem', minHeight: 48, borderRadius: '8px', background: 'var(--fl-acc)', color: 'var(--fl-on-acc)', fontWeight: 'bold', fontSize: '16px', border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          style={{ marginTop: '1rem', fontSize: '14px', lineHeight: 1.45, padding: '0.75rem', borderRadius: '8px',
            color: message.kind === 'error' ? 'var(--fl-bad)' : 'var(--fl-ok)',
            border: `1px solid ${message.kind === 'error' ? 'var(--fl-bad)' : 'var(--fl-ok)'}`,
            background: 'var(--fl-s1)' }}>
          {message.kind === 'error' ? '⚠ ' : '✓ '}{message.text}
        </p>
      )}
      <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null); }}
        style={{ display: 'block', width: '100%', minHeight: 44, color: 'var(--fl-tx2)', marginTop: '0.5rem', textAlign: 'center', cursor: 'pointer', background: 'none', border: 'none', fontSize: '15px' }}>
        {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
      </button>
    </main>
  );
}
