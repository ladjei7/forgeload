'use client';
import { useState } from 'react';
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
        : await supabase.auth.signUp({ email, password });
    if (error) { setMessage(error.message); return; }
    if (mode === 'signup' && !data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
      return;
    }
    router.push('/log');
  }

  const input = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px', marginBottom: '0.75rem', boxSizing: 'border-box' as const };

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>FORGELOAD</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>
      <input style={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={input} type="password" placeholder="Password (6+ characters)" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={submit} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#fff', color: '#000', fontWeight: 'bold', fontSize: '16px', border: 'none', cursor: 'pointer' }}>
        {mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </button>
      <p onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ color: '#888', marginTop: '1rem', textAlign: 'center', cursor: 'pointer' }}>
        {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
      </p>
      {message && <p style={{ color: '#4ade80', marginTop: '1rem', fontSize: '14px' }}>{message}</p>}
    </main>
  );
}