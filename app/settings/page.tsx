'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { buildExport, setsCsv, download } from '../lib/exportData';

const card = 'rounded-2xl bg-[#111] p-5';
const btn = 'h-12 w-full rounded-xl bg-[#222] px-4 font-semibold disabled:opacity-60';

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? '')); }, []);

  async function exportAs(kind: 'json' | 'csv') {
    setBusy(kind); setErr(''); setMsg('');
    try {
      const x = await buildExport();
      const day = new Date().toISOString().slice(0, 10);
      if (kind === 'json') download(`forgeload-export-${day}.json`, JSON.stringify(x, null, 2), 'application/json');
      else download(`forgeload-sets-${day}.csv`, setsCsv(x), 'text/csv');
      setMsg(`Downloaded: ${x.plans.length} plan(s), ${x.sessions.length} workout(s), ${x.custom_exercises.length} custom exercise(s).`);
    } catch (e) { setErr('Export failed: ' + ((e as Error).message || 'check your connection and try again.')); }
    finally { setBusy(''); }
  }

  async function deleteAccount() {
    if (confirmText !== 'DELETE' || busy) return;
    setBusy('delete'); setErr('');
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { setBusy(''); return setErr('Could not delete your account: ' + error.message + (error.message.includes('function') ? ' (the database update 005 has not been run yet).' : '')); }
    await supabase.auth.signOut().catch(() => {});
    router.replace('/login');
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-10 pt-6 text-white">
      <h1 className="text-3xl font-bold">Settings</h1>

      <section className={card}>
        <div className="text-xs uppercase tracking-wide text-[#777]">Signed in as</div>
        <div className="mb-3 truncate">{email || 'your account'}</div>
        <button className={btn} onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>Sign out</button>
      </section>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Your data is yours</h2>
        <p className="mb-4 text-sm text-[#aaa]">Download everything you have logged. The JSON file has your plans, workouts and custom exercises. The CSV has one row per set, ready for a spreadsheet.</p>
        <div className="space-y-2">
          <button className={btn} disabled={!!busy} onClick={() => exportAs('json')}>{busy === 'json' ? 'Preparing...' : 'Download all data (JSON)'}</button>
          <button className={btn} disabled={!!busy} onClick={() => exportAs('csv')}>{busy === 'csv' ? 'Preparing...' : 'Download sets (CSV)'}</button>
        </div>
        {msg && <p role="status" className="mt-3 text-sm text-green-400">{msg}</p>}
      </section>

      <section className={`${card} border border-[#3a1a1a]`}>
        <h2 className="mb-1 text-lg font-bold text-red-300">Delete account</h2>
        <p className="mb-3 text-sm text-[#aaa]">Permanently removes your login and every plan, workout and custom exercise you have. This cannot be undone. Download your data first if you want a copy.</p>
        {!showDelete ? (
          <button className="h-12 w-full rounded-xl bg-[#2a1111] px-4 font-semibold text-red-300" onClick={() => setShowDelete(true)}>Delete my account...</button>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-[#bbb]">Type DELETE to confirm
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoCapitalize="characters" autoComplete="off"
                className="mt-1 h-12 w-full rounded-xl border border-[#3a1a1a] bg-[#1a1a1a] px-3 text-base text-white outline-none focus-visible:ring-2 focus-visible:ring-red-400/60" />
            </label>
            <div className="flex gap-3">
              <button disabled={confirmText !== 'DELETE' || !!busy} onClick={deleteAccount}
                className="h-12 flex-1 rounded-xl bg-red-600 font-bold text-white disabled:opacity-40">{busy === 'delete' ? 'Deleting...' : 'Delete forever'}</button>
              <button onClick={() => { setShowDelete(false); setConfirmText(''); }} className="h-12 rounded-xl bg-[#222] px-5">Cancel</button>
            </div>
          </div>
        )}
      </section>
      {err && <p role="alert" className="rounded-xl bg-[#2a1111] p-3 text-sm text-red-300">{err}</p>}
      <p className="text-center text-xs text-[#666]"><Link href="/" className="underline">Back to Home</Link></p>
    </main>
  );
}
