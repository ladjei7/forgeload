'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TEMPLATES } from '../lib/templates';
import { recommendPlan, tailorTemplate, GOAL_NOTE, TIME_NOTE, type Experience, type Goal, type Minutes } from '../lib/recommend';
import { createPlanFromTemplate } from '../lib/applyTemplate';

type Choice<T> = { id: T; icon: string; title: string; sub: string };

const DAYS: Choice<number>[] = [
  { id: 2, icon: '2', title: '2 days', sub: 'Short on time? Still enough to make progress.' },
  { id: 3, icon: '3', title: '3 days', sub: 'A classic. Rest days built in.' },
  { id: 4, icon: '4', title: '4 days', sub: 'The sweet spot for most people.' },
  { id: 5, icon: '5', title: '5 days', sub: 'Committed. Plenty of volume.' },
  { id: 6, icon: '6', title: '6 days', sub: 'All in. Recovery matters here.' },
];
const EXP: Choice<Experience>[] = [
  { id: 'new', icon: '🌱', title: 'Just starting out', sub: 'Under 6 months of steady training' },
  { id: 'some', icon: '🔥', title: 'Getting stronger', sub: '6 months to 2 years' },
  { id: 'experienced', icon: '🏋️', title: 'Seasoned lifter', sub: 'More than 2 years' },
];
const GOALS: Choice<Goal>[] = [
  { id: 'muscle', icon: '💪', title: 'Build muscle', sub: 'Size and shape' },
  { id: 'strength', icon: '⚡', title: 'Get stronger', sub: 'Heavier weight on the big lifts' },
  { id: 'both', icon: '🎯', title: 'A bit of both', sub: 'Strength on the main lift, size everywhere else' },
];
const TIMES: Choice<Minutes>[] = [
  { id: 45, icon: '⏱️', title: 'About 45 minutes', sub: 'Quick and focused' },
  { id: 60, icon: '🕐', title: 'About an hour', sub: 'The usual' },
  { id: 90, icon: '🕰️', title: '75 minutes or more', sub: 'No rush' },
];

const STEPS = ['days', 'experience', 'goal', 'time'] as const;
const QUESTION = {
  days: ['How many days a week can you train?', 'Be realistic. A plan you can keep beats a perfect one.'],
  experience: ['How long have you been lifting?', 'This helps us avoid starting you too hard.'],
  goal: ['What is your main goal?', 'This sets how heavy your main lifts are.'],
  time: ['How long is a typical workout?', 'We will fit the plan to your time.'],
} as const;

function Card<T extends string | number>({ c, on, pick }: { c: Choice<T>; on: boolean; pick: (v: T) => void }) {
  return (
    <button
      onClick={() => pick(c.id)} aria-pressed={on}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-green-400/60 outline-none ${on ? 'border-green-400 bg-green-400/10' : 'border-transparent bg-[#111] hover:bg-[#161616]'}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1d1d1d] text-2xl font-bold">{c.icon}</span>
      <span className="min-w-0"><span className="block text-lg font-semibold">{c.title}</span><span className="block text-sm text-[#888]">{c.sub}</span></span>
    </button>
  );
}

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [days, setDays] = useState(0);
  const [exp, setExp] = useState<Experience | ''>('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [mins, setMins] = useState<Minutes | 0>(0);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const done = step >= STEPS.length;
  const rec = days && exp ? recommendPlan(days, exp) : null;
  const chosenId = picked || rec?.primary || '';
  const base = TEMPLATES.find(t => t.id === chosenId);
  const tpl = base && goal && mins ? tailorTemplate(base, goal, mins) : null;

  function answer(setter: () => void) { setter(); setPicked(''); setTimeout(() => setStep(s => s + 1), 180); }

  async function create() {
    if (!tpl || busy) return;
    setBusy(true); setError('');
    const res = await createPlanFromTemplate(tpl);
    if ('error' in res) { setBusy(false); return setError('Could not create the plan: ' + res.error); }
    try { localStorage.setItem('fl-plan', res.planId); } catch { /* optional */ }
    router.push('/');
  }

  const bar = (
    <div className="mb-6 flex gap-2" aria-label={`Step ${Math.min(step + 1, 4)} of 4`}>
      {STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step || done ? 'bg-green-400' : i === step ? 'bg-green-400/50' : 'bg-[#222]'}`} />)}
    </div>
  );

  if (!done) {
    const key = STEPS[step];
    return (
      <main className="mx-auto max-w-xl px-4 pb-10 pt-6 text-white">
        {bar}
        <h1 className="mb-1 text-3xl font-bold leading-tight">{QUESTION[key][0]}</h1>
        <p className="mb-6 text-[#888]">{QUESTION[key][1]}</p>
        <div className="space-y-3">
          {key === 'days' && DAYS.map(c => <Card key={c.id} c={c} on={days === c.id} pick={v => answer(() => setDays(v))} />)}
          {key === 'experience' && EXP.map(c => <Card key={c.id} c={c} on={exp === c.id} pick={v => answer(() => setExp(v))} />)}
          {key === 'goal' && GOALS.map(c => <Card key={c.id} c={c} on={goal === c.id} pick={v => answer(() => setGoal(v))} />)}
          {key === 'time' && TIMES.map(c => <Card key={c.id} c={c} on={mins === c.id} pick={v => answer(() => setMins(v))} />)}
        </div>
        <div className="mt-6 flex items-center justify-between text-sm">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="h-11 px-2 text-[#aaa]">← Back</button> : <span />}
          <Link href="/plan" className="text-[#777] underline-offset-2 hover:underline">Build it myself instead</Link>
        </div>
      </main>
    );
  }

  const chips = [`${days} days a week`, EXP.find(e => e.id === exp)?.title, GOALS.find(g => g.id === goal)?.title, TIMES.find(t => t.id === mins)?.title];
  const others = rec ? [rec.primary, ...rec.alternatives].filter(id => id !== chosenId) : [];

  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-6 text-white">
      {bar}
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c, i) => <span key={i} className="rounded-full bg-[#1a1a1a] px-3 py-1 text-xs text-[#bbb]">{c}</span>)}
      </div>
      {rec && tpl && (
        <>
          <div className="text-xs uppercase tracking-wide text-green-400">{picked && picked !== rec.primary ? 'Your pick' : 'Built for you'}</div>
          <h1 className="mb-1 mt-1 text-3xl font-bold leading-tight">{tpl.name}</h1>
          <p className="mb-4 text-[#aaa]">{tpl.blurb}</p>
          <div className="mb-4 space-y-2 rounded-2xl bg-[#111] p-4 text-sm leading-relaxed text-[#ccc]">
            <p><span className="font-semibold text-white">Why this split. </span>{rec.why}</p>
            <p><span className="font-semibold text-white">Your goal. </span>{GOAL_NOTE[goal as Goal]}</p>
            <p><span className="font-semibold text-white">Your time. </span>{TIME_NOTE[mins as Minutes]}</p>
          </div>
          <div className="mb-4 space-y-3">
            {tpl.days.map((d, i) => (
              <details key={i} className="rounded-2xl bg-[#111] px-4 py-3" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="font-semibold">{d.name}</span><span className="text-sm text-[#777]">{d.exercises.length} exercises</span>
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.exercises.map((e, j) => <li key={j} className="flex justify-between gap-3"><span>{e[0]}</span><span className="shrink-0 text-[#777]">{e[1]} × {e[2]}-{e[3]}</span></li>)}
                </ul>
              </details>
            ))}
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
          <button onClick={create} disabled={busy} className="h-14 w-full rounded-xl bg-green-400 text-lg font-bold text-black disabled:opacity-60">
            {busy ? 'Creating...' : 'Create this plan'}
          </button>
          <p className="mt-2 text-center text-xs text-[#666]">You can rename days and swap any exercise afterward.</p>
          {others.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs uppercase tracking-wide text-[#777]">Other options</div>
              <div className="space-y-2">
                {others.map(id => {
                  const t = TEMPLATES.find(x => x.id === id)!;
                  return (
                    <button key={id} onClick={() => setPicked(id)} className="w-full rounded-2xl bg-[#111] px-4 py-3 text-left">
                      <span className="block font-semibold">{t.name}</span><span className="block text-sm text-[#888]">{t.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button onClick={() => { setStep(0); setPicked(''); }} className="mt-6 h-11 w-full text-sm text-[#aaa]">← Change my answers</button>
        </>
      )}
    </main>
  );
}
