'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { pendingOnDevice } from '../lib/outboxSync';
import { buildExport, setsCsv, download } from '../lib/exportData';
import type { Comfort } from '../lib/comfort';

const COMFORTS: { id: Comfort; title: string; sub: string }[] = [
  { id: 'machines', title: 'Mostly machines', sub: 'Guided movements while getting comfortable.' },
  { id: 'mixed', title: 'Machines and dumbbells', sub: 'A combination of both.' },
  { id: 'all', title: 'All gym equipment', sub: 'Barbells, dumbbells, and machines.' },
  { id: 'unsure', title: 'Not sure', sub: 'Choose for me.' },
];

const card = 'rounded-2xl bg-fl-s1 border border-fl-line p-5';
const btn = 'h-12 w-full rounded-xl bg-fl-s2 px-4 font-semibold disabled:opacity-60';

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const [comfort, setComfort] = useState<Comfort | ''>('');
  const [prefMsg, setPrefMsg] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => { try { if (localStorage.getItem('fl-theme') === 'light') setTheme('light'); } catch { /* optional */ } }, []);
  function pickTheme(t: 'dark' | 'light') {
    setTheme(t);
    try { localStorage.setItem('fl-theme', t); } catch { /* optional */ }
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
  }

  useEffect(() => {
    supabase.from('user_training_prefs').select('comfort').maybeSingle().then(({ data }) => { if (data?.comfort) setComfort(data.comfort as Comfort); });
  }, []);

  async function saveComfort(c: Comfort) {
    const prev = comfort; setComfort(c); setPrefMsg('');
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from('user_training_prefs').upsert({ user_id: u.user.id, comfort: c, updated_at: new Date().toISOString() });
    if (error) { setComfort(prev); return setErr('Could not save your preference: ' + error.message); }
    try { localStorage.setItem('fl-comfort', c); } catch { /* optional */ }
    setPrefMsg('Saved. Your current plan and history are unchanged.');
  }

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
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-10 pt-6 text-fl-tx">
      <h1 className="text-3xl font-bold">Settings</h1>

      <section className={card}>
        <div className="text-xs uppercase tracking-wide text-fl-tx2">Signed in as</div>
        <div className="mb-3 truncate">{email || 'your account'}</div>
        <button className={btn} onClick={async () => {
          const n = pendingOnDevice();
          if (n > 0 && !confirm(`${n} set${n === 1 ? ' is' : 's are'} saved on this device but not yet synced to your account. They stay on this device and sync when you sign back in here. Sign out anyway?`)) return;
          await supabase.auth.signOut(); router.replace('/login');
        }}>Sign out</button>
      </section>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Training days</h2>
        <p className="mb-3 text-sm text-fl-tx2">Want to train more or fewer days a week? We&apos;ll build a new plan to match. Your old plan and everything you&apos;ve logged are kept.</p>
        <Link href="/start?change=1" className="flex h-12 items-center justify-center rounded-xl bg-fl-s2 font-semibold">Change training days</Link>
      </section>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Appearance</h2>
        <p className="mb-3 text-sm text-fl-tx2">Dark is the default. Light is easier to read in bright gyms and outdoors. This is saved on this device.</p>
        <div role="radiogroup" aria-label="Theme" className="flex gap-2">
          {(['dark', 'light'] as const).map(t => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => pickTheme(t)}
              className={`h-12 flex-1 rounded-xl font-semibold ${theme === t ? 'bg-fl-acc text-fl-on-acc' : 'bg-fl-s2'}`}>{t === 'dark' ? 'Dark' : 'Light'}</button>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Exercise comfort</h2>
        <p className="mb-3 text-sm text-fl-tx2">Used when you start a new plan and to word suggestions. It never changes your current plan or past workouts, and it never adds barbells unless you choose all equipment.</p>
        <div role="radiogroup" aria-label="Exercise comfort" className="space-y-2">
          {COMFORTS.map(c => (
            <button key={c.id} role="radio" aria-checked={comfort === c.id} onClick={() => saveComfort(c.id)}
              className={`w-full rounded-xl px-4 py-3 text-left ${comfort === c.id ? 'bg-fl-s2 ring-2 ring-fl-acc' : 'bg-fl-s2'}`}>
              <div className="font-semibold">{c.title}</div><div className="text-sm text-fl-tx2">{c.sub}</div>
            </button>
          ))}
        </div>
        {prefMsg && <p role="status" className="mt-3 text-sm text-fl-ok">{prefMsg}</p>}
      </section>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Your data is yours</h2>
        <p className="mb-4 text-sm text-fl-tx2">Download everything you have logged. The JSON file has your plans, workouts and custom exercises. The CSV has one row per set, ready for a spreadsheet.</p>
        <div className="space-y-2">
          <button className={btn} disabled={!!busy} onClick={() => exportAs('json')}>{busy === 'json' ? 'Preparing...' : 'Download all data (JSON)'}</button>
          <button className={btn} disabled={!!busy} onClick={() => exportAs('csv')}>{busy === 'csv' ? 'Preparing...' : 'Download sets (CSV)'}</button>
        </div>
        {msg && <p role="status" className="mt-3 text-sm text-fl-ok">{msg}</p>}
      </section>

      <section className={`rounded-2xl bg-fl-s1 p-5 border border-fl-bad/40`}>
        <h2 className="mb-1 text-lg font-bold text-fl-bad">Delete account</h2>
        <p className="mb-3 text-sm text-fl-tx2">Permanently removes your login and every plan, workout and custom exercise you have. This cannot be undone. Download your data first if you want a copy.</p>
        {!showDelete ? (
          <button className="h-12 w-full rounded-xl bg-fl-s2 px-4 font-semibold text-fl-bad" onClick={() => setShowDelete(true)}>Delete my account...</button>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-fl-tx2">Type DELETE to confirm
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoCapitalize="characters" autoComplete="off"
                className="mt-1 h-12 w-full rounded-xl border border-fl-bad/40 bg-fl-s2 px-3 text-base text-fl-tx outline-none focus-visible:ring-2 focus-visible:ring-red-400/60" />
            </label>
            <div className="flex gap-3">
              <button disabled={confirmText !== 'DELETE' || !!busy} onClick={deleteAccount}
                className="h-12 flex-1 rounded-xl bg-fl-bad font-bold text-fl-on-acc disabled:opacity-40">{busy === 'delete' ? 'Deleting...' : 'Delete forever'}</button>
              <button onClick={() => { setShowDelete(false); setConfirmText(''); }} className="h-12 rounded-xl bg-fl-s2 px-5">Cancel</button>
            </div>
          </div>
        )}
      </section>
      {err && <p role="alert" className="rounded-xl bg-fl-s2 p-3 text-sm text-fl-bad">{err}</p>}
      <p className="text-center text-xs text-fl-tx2">Exercise data by <a href="https://repdb.co" rel="nofollow noopener" target="_blank" className="underline">RepDB (repdb.co)</a></p>
      <p className="text-center text-xs text-fl-tx2"><Link href="/" className="underline">Back to Home</Link></p>
    </main>
  );
}
