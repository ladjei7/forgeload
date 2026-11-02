'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TEMPLATES } from '../lib/templates';
import { recommendPlan, type Experience } from '../lib/recommend';
import { createPlanFromTemplate } from '../lib/applyTemplate';

const DAYS = [2, 3, 4, 5, 6];
const EXP: { id: Experience; label: string; sub: string }[] = [
  { id: 'new', label: 'New to lifting', sub: 'Less than 6 months of steady training' },
  { id: 'some', label: 'Some experience', sub: '6 months to 2 years' },
  { id: 'experienced', label: 'Experienced', sub: 'More than 2 years' },
];
const opt = 'flex min-h-14 w-full flex-col items-start justify-center rounded-xl bg-[#111] px-4 py-3 text-left active:bg-[#1c1c1c] focus-visible:ring-2 focus-visible:ring-green-400/60 outline-none';

export default function StartPage() {
  const router = useRouter();
  const [days, setDays] = useState(0);
  const [exp, setExp] = useState<Experience | ''>('');
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rec = days && exp ? recommendPlan(days, exp) : null;
  const chosenId = picked || rec?.primary || '';
  const tpl = TEMPLATES.find(t => t.id === chosenId);

  async function create() {
    if (!tpl || busy) return;
    setBusy(true); setError('');
    const res = await createPlanFromTemplate(tpl);
    if ('error' in res) { setBusy(false); return setError('Could not create the plan: ' + res.error); }
    try { localStorage.setItem('fl-plan', res.planId); } catch { /* optional */ }
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-6 text-white">
      <h1 className="mb-1 text-3xl font-bold">Set up your plan</h1>
      <p className="mb-6 text-sm text-[#888]">Two quick questions. You can change anything afterward.</p>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">How many days a week can you train?</h2>
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Days per week">
          {DAYS.map(n => (
            <button key={n} aria-pressed={days === n} onClick={() => { setDays(n); setPicked(''); }}
              className={`h-14 rounded-xl text-xl font-bold ${days === n ? 'bg-green-400 text-black' : 'bg-[#111]'}`}>{n}</button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">How long have you been lifting?</h2>
        <div className="space-y-2" role="group" aria-label="Experience">
          {EXP.map(e => (
            <button key={e.id} aria-pressed={exp === e.id} onClick={() => { setExp(e.id); setPicked(''); }}
              className={`${opt} ${exp === e.id ? 'ring-2 ring-green-400' : ''}`}>
              <span className="font-semibold">{e.label}</span><span className="text-sm text-[#888]">{e.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {rec && tpl && (
        <section className="rounded-2xl bg-[#111] p-5" aria-live="polite">
          <div className="text-xs uppercase tracking-wide text-[#777]">{picked && picked !== rec.primary ? 'Your pick' : 'Suggested for you'}</div>
          <h2 className="mb-1 mt-1 text-2xl font-bold">{tpl.name}</h2>
          <p className="mb-3 text-sm text-[#aaa]">{tpl.blurb}</p>
          <p className="mb-4 text-sm leading-relaxed text-[#ccc]">{rec.why}</p>
          <ul className="mb-4 space-y-1 text-sm text-[#999]">
            {tpl.days.map((d, i) => <li key={i}><span className="text-white">{d.name}</span> · {d.exercises.length} exercises</li>)}
          </ul>
          {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
          <button onClick={create} disabled={busy} className="h-14 w-full rounded-xl bg-green-400 text-lg font-bold text-black disabled:opacity-60">
            {busy ? 'Creating...' : 'Create this plan'}
          </button>
          {rec.primary !== chosenId || rec.alternatives.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-[#777]">Other options</div>
              <div className="space-y-2">
                {[rec.primary, ...rec.alternatives].filter(id => id !== chosenId).map(id => {
                  const t = TEMPLATES.find(x => x.id === id)!;
                  return <button key={id} onClick={() => setPicked(id)} className={opt + ' !bg-[#1a1a1a]'}><span className="font-semibold">{t.name}</span><span className="text-sm text-[#888]">{t.blurb}</span></button>;
                })}
              </div>
            </div>
          ) : null}
        </section>
      )}

      <p className="mt-6 text-center text-sm text-[#777]">
        Prefer to build it yourself? <Link href="/plan" className="text-green-400 underline">Go to Plan</Link>
      </p>
    </main>
  );
}
