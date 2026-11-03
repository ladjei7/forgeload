'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');

  async function submit() {
    setMessage('');
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) { setMessage(error.message); return; }
    if (mode === 'signup' && !data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
      return;
    }
    router.push('/');
  }

  const input = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--fl-line)', background: 'var(--fl-s2)', color: 'var(--fl-tx)', fontSize: '16px', marginBottom: '0.75rem', boxSizing: 'border-box' as const };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--fl-bg)', color: 'var(--fl-tx)', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 1.25rem' }}>
        <Image src="/logo.png" alt="Forgeload" width={640} height={456} priority style={{ width: '70%', maxWidth: 260, height: 'auto', display: 'block', margin: '0 auto' }} />
      </h1>
      <p style={{ color: 'var(--fl-tx2)', marginBottom: '2rem' }}>{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>
      <input style={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={input} type="password" placeholder="Password (6+ characters)" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={submit} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--fl-acc)', color: 'var(--fl-on-acc)', fontWeight: 'bold', fontSize: '16px', border: 'none', cursor: 'pointer' }}>
        {mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </button>
      <p onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ color: 'var(--fl-tx2)', marginTop: '1rem', textAlign: 'center', cursor: 'pointer' }}>
        {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
      </p>
      {message && <p style={{ color: 'var(--fl-ok)', marginTop: '1rem', fontSize: '14px' }}>{message}</p>}
    </main>
  );
}