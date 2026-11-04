'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TEMPLATES } from '../lib/templates';
import { recommendPlan, tailorTemplate, GOAL_NOTE, TIME_NOTE, type Experience, type Goal, type Minutes } from '../lib/recommend';
import { createPlanFromTemplate } from '../lib/applyTemplate';
import { applyComfort, type Comfort } from '../lib/comfort';
import { supabase } from '../lib/supabase';

type Choice<T> = { id: T; icon: string; title: string; sub: string };

const DAYS: Choice<number>[] = [
  { id: 1, icon: '1', title: '1 day', sub: 'Better than none. The plan rotates week to week.' },
  { id: 2, icon: '2', title: '2 days', sub: 'Short on time? Still enough to make progress.' },
  { id: 3, icon: '3', title: '3 days', sub: 'A classic. Rest days built in.' },
  { id: 4, icon: '4', title: '4 days', sub: 'The sweet spot for most people.' },
  { id: 5, icon: '5', title: '5 days', sub: 'Committed. Plenty of volume.' },
  { id: 6, icon: '6', title: '6 days', sub: 'All in. Recovery matters here.' },
];
const EXP: Choice<Experience>[] = [
  { id: 'brand_new', icon: '🌱', title: 'Brand new', sub: 'I have never really lifted' },
  { id: 'new', icon: '🌿', title: 'Beginner', sub: 'Under about 6 months of steady training' },
  { id: 'some', icon: '🔥', title: 'Intermediate', sub: 'About 6 months to 2 years' },
  { id: 'experienced', icon: '🏋️', title: 'Advanced', sub: 'More than 2 years, I know my way around' },
];
const GOALS: Choice<Goal>[] = [
  { id: 'muscle', icon: '💪', title: 'Build muscle', sub: 'Size and shape' },
  { id: 'strength', icon: '⚡', title: 'Get stronger', sub: 'Heavier weight on the big lifts' },
  { id: 'fat_loss', icon: '🔥', title: 'Lose body fat', sub: 'While keeping or building muscle' },
  { id: 'fitness', icon: '❤️', title: 'Improve general fitness', sub: 'Feel stronger and fitter overall' },
];
const TIMES: Choice<Minutes>[] = [
  { id: 25, icon: '⏱️', title: '20 to 30 minutes', sub: 'Quick and focused' },
  { id: 40, icon: '🕐', title: '30 to 45 minutes', sub: 'A solid session' },
  { id: 55, icon: '🕑', title: '45 to 60 minutes', sub: 'The usual' },
  { id: 75, icon: '🕰️', title: 'More than 60 minutes', sub: 'No rush' },
];

const COMFORTS: Choice<Comfort>[] = [
  { id: 'machines', icon: '🛠️', title: 'Mostly machines', sub: 'I prefer guided movements while getting comfortable.' },
  { id: 'mixed', icon: '🔀', title: 'Machines and dumbbells', sub: "I'm comfortable combining machines and dumbbells." },
  { id: 'all', icon: '🏋️', title: 'All gym equipment', sub: "I'm comfortable using barbells, dumbbells, cables, and machines." },
  { id: 'unsure', icon: '🤷', title: "I'm not sure, choose for me", sub: 'Recommend an approachable starting point.' },
];

const STEPS = ['days', 'experience', 'goal', 'time', 'comfort'] as const;
const QUESTION = {
  days: ['How many days a week can you train?', 'Be realistic. A plan you can keep beats a perfect one.'],
  experience: ['How experienced are you with strength training?', 'This helps us avoid starting you too hard. Not sure? Pick the lower one.'],
  goal: ["What's your main fitness goal?", 'This sets your rep ranges. You can change it later.'],
  time: ['How much time can you spend per workout?', 'We will fit the plan to your time.'],
  comfort: ['What exercises would you feel most comfortable starting with?', 'This only picks your starting exercises. You can change it any time, and you can swap any exercise later.'],
} as const;

function Card<T extends string | number>({ c, on, pick }: { c: Choice<T>; on: boolean; pick: (v: T) => void }) {
  return (
    <button
      onClick={() => pick(c.id)} aria-pressed={on}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-fl-acc/60 outline-none ${on ? 'border-fl-acc bg-fl-acc/10' : 'border-transparent bg-fl-s1 border border-fl-line hover:bg-fl-s2'}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fl-s2 text-2xl font-bold">{c.icon}</span>
      <span className="min-w-0"><span className="block text-lg font-semibold">{c.title}</span><span className="block text-sm text-fl-tx2">{c.sub}</span></span>
    </button>
  );
}

export default function StartPage() {
  const router = useRouter();
  // Answers survive a refresh or a trip away from the page (this browser only), so nobody has to start over.
  const saved = useState(() => { try { return JSON.parse(localStorage.getItem('fl-start') ?? '{}') as Record<string, unknown>; } catch { return {}; } })[0];
  const valid = <T,>(v: unknown, opts: Choice<T>[]): T | undefined => opts.find(o => o.id === v)?.id;
  const [step, setStep] = useState(() => Math.min(Number(saved.step) || 0, STEPS.length - 1));
  const [days, setDays] = useState(() => valid(saved.days, DAYS) ?? 0);
  const [exp, setExp] = useState<Experience | ''>(() => valid(saved.exp, EXP) ?? '');
  const [goal, setGoal] = useState<Goal | ''>(() => valid(saved.goal, GOALS) ?? '');
  const [mins, setMins] = useState<Minutes | 0>(() => valid(saved.mins, TIMES) ?? 0);
  const [comfort, setComfort] = useState<Comfort | ''>(() => valid(saved.comfort, COMFORTS) ?? '');
  useEffect(() => { try { localStorage.setItem('fl-start', JSON.stringify({ step, days, exp, goal, mins, comfort })); } catch { /* optional */ } }, [step, days, exp, goal, mins, comfort]);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const done = step >= STEPS.length;
  const rec = days && exp ? recommendPlan(days, exp) : null;
  const chosenId = picked || rec?.primary || '';
  const base = TEMPLATES.find(t => t.id === chosenId);
  const adapted = base && comfort ? applyComfort(base, comfort) : null;
  const tpl = adapted && goal && mins ? tailorTemplate(adapted.tpl, goal, mins) : null;

  function answer(setter: () => void) { setter(); setPicked(''); setTimeout(() => setStep(s => s + 1), 180); }

  async function create() {
    if (!tpl || busy) return;
    setBusy(true); setError('');
    const res = await createPlanFromTemplate(tpl);
    if ('error' in res) { setBusy(false); return setError('Could not create the plan: ' + res.error); }
    try { localStorage.setItem('fl-plan', res.planId); localStorage.setItem('fl-comfort', comfort); localStorage.removeItem('fl-start'); } catch { /* optional */ }
    try { // best effort: the plan is already created even if preferences cannot be saved
      const { data: u } = await supabase.auth.getUser();
      if (u.user && comfort) await supabase.from('user_training_prefs').upsert({ user_id: u.user.id, comfort, session_minutes: mins || null, updated_at: new Date().toISOString() });
    } catch { /* optional */ }
    router.push('/');
  }

  const bar = (
    <div className="mb-6 flex gap-2" aria-label={`Step ${Math.min(step + 1, STEPS.length)} of ${STEPS.length}`}>
      {STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step || done ? 'bg-fl-acc' : i === step ? 'bg-fl-acc/50' : 'bg-fl-s2'}`} />)}
    </div>
  );

  if (!done) {
    const key = STEPS[step];
    return (
      <main className="mx-auto max-w-xl px-4 pb-10 pt-6 text-fl-tx">
        {bar}
        <h1 className="mb-1 text-3xl font-bold leading-tight">{QUESTION[key][0]}</h1>
        <p className="mb-6 text-fl-tx2">{QUESTION[key][1]}</p>
        <div className="space-y-3">
          {key === 'days' && DAYS.map(c => <Card key={c.id} c={c} on={days === c.id} pick={v => answer(() => setDays(v))} />)}
          {key === 'experience' && EXP.map(c => <Card key={c.id} c={c} on={exp === c.id} pick={v => answer(() => setExp(v))} />)}
          {key === 'goal' && GOALS.map(c => <Card key={c.id} c={c} on={goal === c.id} pick={v => answer(() => setGoal(v))} />)}
          {key === 'time' && TIMES.map(c => <Card key={c.id} c={c} on={mins === c.id} pick={v => answer(() => setMins(v))} />)}
          {key === 'comfort' && COMFORTS.map(c => <Card key={c.id} c={c} on={comfort === c.id} pick={v => answer(() => setComfort(v))} />)}
        </div>
        <div className="mt-6 flex items-center justify-between text-sm">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="h-11 px-2 text-fl-tx2">← Back</button> : <span />}
          <Link href="/plan" className="text-fl-tx2 underline-offset-2 hover:underline">Build it myself instead</Link>
        </div>
      </main>
    );
  }

  const chips = [`${days} days a week`, EXP.find(e => e.id === exp)?.title, GOALS.find(g => g.id === goal)?.title, TIMES.find(t => t.id === mins)?.title, COMFORTS.find(c => c.id === comfort)?.title];
  const others = rec ? [rec.primary, ...rec.alternatives].filter(id => id !== chosenId) : [];

  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-6 text-fl-tx">
      {bar}
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c, i) => <span key={i} className="rounded-full bg-fl-s2 px-3 py-1 text-xs text-fl-tx2">{c}</span>)}
      </div>
      {rec && tpl && (
        <>
          <div className="text-xs uppercase tracking-wide text-fl-acc">{picked && picked !== rec.primary ? 'Your pick' : 'Built for you'}</div>
          <h1 className="mb-1 mt-1 text-3xl font-bold leading-tight">{tpl.name}</h1>
          <p className="mb-4 text-fl-tx2">{tpl.blurb}</p>
          <div className="mb-4 space-y-2 rounded-2xl bg-fl-s1 border border-fl-line p-4 text-sm leading-relaxed text-fl-tx2">
            <p><span className="font-semibold text-fl-tx">Why this split. </span>{rec.why}</p>
            <p><span className="font-semibold text-fl-tx">Your goal. </span>{GOAL_NOTE[goal as Goal]}</p>
            <p><span className="font-semibold text-fl-tx">Your time. </span>{TIME_NOTE[mins as Minutes]}</p>
            {adapted && adapted.notes.length > 0 && <p><span className="font-semibold text-fl-tx">Your comfort. </span>{adapted.notes.join(' ')}</p>}
          </div>
          <div className="mb-4 space-y-3">
            {tpl.days.map((d, i) => (
              <details key={i} className="rounded-2xl bg-fl-s1 border border-fl-line px-4 py-3" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="font-semibold">{d.name}</span><span className="text-sm text-fl-tx2">{d.exercises.length} exercises</span>
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.exercises.map((e, j) => <li key={j} className="flex justify-between gap-3"><span>{e[0]}{adapted?.swapped[e[0]] && <span className="block text-xs text-fl-tx2">Instead of {adapted.swapped[e[0]]}</span>}</span><span className="shrink-0 text-fl-tx2">{e[1]} × {e[2]}-{e[3]}</span></li>)}
                </ul>
              </details>
            ))}
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-fl-bad">{error}</p>}
          <button onClick={create} disabled={busy} className="h-14 w-full rounded-xl bg-fl-acc text-lg font-bold text-fl-on-acc disabled:opacity-60">
            {busy ? 'Creating...' : 'Create this plan'}
          </button>
          <p className="mt-2 text-center text-xs text-fl-tx2">You can rename days and swap any exercise afterward.</p>
          {others.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs uppercase tracking-wide text-fl-tx2">Other options</div>
              <div className="space-y-2">
                {others.map(id => {
                  const t = TEMPLATES.find(x => x.id === id)!;
                  return (
                    <button key={id} onClick={() => setPicked(id)} className="w-full rounded-2xl bg-fl-s1 border border-fl-line px-4 py-3 text-left">
                      <span className="block font-semibold">{t.name}</span><span className="block text-sm text-fl-tx2">{t.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button onClick={() => { setStep(0); setPicked(''); }} className="mt-6 h-11 w-full text-sm text-fl-tx2">← Change my answers</button>
        </>
      )}
    </main>
  );
}
