'use client';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Icon, LevelBars } from '../components/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TEMPLATES, forExperience, blurbFor } from '../lib/templates';
import { recommendPlan, tailorTemplate, fitToTime, GOAL_NOTE, TIME_NOTE, type Experience, type Goal, type Minutes } from '../lib/recommend';
import { createPlanFromTemplate } from '../lib/applyTemplate';
import { applyComfort, type Comfort } from '../lib/comfort';
import { supabase } from '../lib/supabase';
import { pickCurrent, setCurrentPlan, storedPlanId } from '../lib/currentPlan';
import { applyAreas, applyFocus, inFocus, detectAreas, AREAS, FOCUSES, type Focus } from '../lib/personalize';
import { getUnit, setUnitLocal, type Unit } from '../lib/units';
import { savePrefs } from '../lib/prefs';

// Session length shown as the minutes themselves (upper end of the range).
const Mins = ({ n }: { n: string }) => <span className="flex flex-col items-center leading-none"><span className="text-base font-bold">{n}</span><span className="mt-0.5 text-[10px] font-medium text-fl-tx2">min</span></span>;

type Choice<T> = { id: T; icon: ReactNode; title: string; sub: string };

const DAYS: Choice<number>[] = [
  { id: 1, icon: '1', title: '1 day', sub: "A start. You'll still get stronger, just more slowly." },
  { id: 2, icon: '2', title: '2 days', sub: 'Enough for real progress.' },
  { id: 3, icon: '3', title: '3 days', sub: 'A classic. Rest days built in.' },
  { id: 4, icon: '4', title: '4 days', sub: 'The sweet spot for most people.' },
  { id: 5, icon: '5', title: '5 days', sub: 'Committed. Plenty of volume.' },
  { id: 6, icon: '6', title: '6 days', sub: 'All in. Recovery matters here.' },
];
const EXP: Choice<Experience>[] = [
  { id: 'new', icon: <LevelBars level={1} />, title: 'Beginner', sub: 'New to lifting, or under about 6 months' },
  { id: 'some', icon: <LevelBars level={2} />, title: 'Intermediate', sub: 'About 6 months to 2 years' },
  { id: 'experienced', icon: <LevelBars level={3} />, title: 'Advanced', sub: 'More than 2 years, I know my way around' },
];
const GOALS: Choice<Goal>[] = [
  { id: 'muscle', icon: <Icon name="grow" size={26} />, title: 'Build muscle', sub: 'Size and shape' },
  { id: 'strength', icon: <Icon name="barbell" size={26} />, title: 'Get stronger', sub: 'Heavier weight on the big lifts' },
  { id: 'fat_loss', icon: <Icon name="flame" size={26} />, title: 'Lose body fat', sub: 'While keeping or building muscle' },
];
const TIMES: Choice<Minutes>[] = [
  { id: 25, icon: <Mins n="30" />, title: '20 to 30 minutes', sub: 'Quick and focused' },
  { id: 40, icon: <Mins n="45" />, title: '30 to 45 minutes', sub: 'A solid session' },
  { id: 55, icon: <Mins n="60" />, title: '45 to 60 minutes', sub: 'The usual' },
  { id: 75, icon: <Mins n="60+" />, title: 'More than 60 minutes', sub: 'No rush' },
];

const COMFORTS: Choice<Comfort>[] = [
  { id: 'machines', icon: <Icon name="machine" size={26} />, title: 'Mostly machines', sub: 'I prefer guided movements while getting comfortable.' },
  { id: 'mixed', icon: <Icon name="dumbbell" size={26} />, title: 'Machines and dumbbells', sub: "I'm comfortable combining machines and dumbbells." },
  { id: 'all', icon: <Icon name="barbell" size={26} />, title: 'All gym equipment', sub: "I'm comfortable using barbells, dumbbells, cables, and machines." },
  { id: 'unsure', icon: <Icon name="help" size={26} />, title: "I'm not sure, choose for me", sub: 'Recommend an approachable starting point.' },
];

const STEPS = ['days', 'experience', 'goal', 'focus', 'time', 'comfort', 'areas'] as const;
const QUESTION = {
  days: ['How many days per week can you realistically train?', 'Be realistic. A plan you can keep beats a perfect one.'],
  experience: ['How experienced are you with strength training?', 'This helps us avoid starting you too hard. Not sure? Pick the lower one.'],
  goal: ["What's your main fitness goal?", 'This sets your rep ranges. You can change it later.'],
  time: ['How much time can you spend per workout?', 'We will fit the plan to your time.'],
  comfort: ['What exercises would you feel most comfortable starting with?', 'This only picks your starting exercises. You can change it any time, and you can swap any exercise later.'],
  focus: ['Focus areas', 'Pick up to two for a little extra work there, or keep it balanced.'],
  areas: ['Any known injuries?', 'Tell us in your own words, for example "bad left knee" or "shoulder surgery last year". We\'ll start with gentler exercises for that area.'],
} as const;

/** Multi-select option: toggles, never advances by itself. */
function Toggle({ title, sub, on, toggle }: { title: string; sub?: string; on: boolean; toggle: () => void }) {
  return (
    <button onClick={toggle} aria-pressed={on}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-fl-acc/60 ${on ? 'border-fl-acc bg-fl-acc/10' : 'border border-fl-line bg-fl-s1 hover:bg-fl-s2'}`}>
      <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-fl-acc bg-fl-acc text-fl-on-acc' : 'border-fl-field'}`}>{on && <Icon name="check" size={16} />}</span>
      <span className="min-w-0"><span className="block text-lg font-semibold">{title}</span>{sub && <span className="block text-sm text-fl-tx2">{sub}</span>}</span>
    </button>
  );
}

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
  return <Suspense fallback={null}><StartFromParams /></Suspense>;
}

// ?change=1: someone with a plan is changing their training days. Same questions, new plan, old plan kept.
function StartFromParams() {
  const change = useSearchParams()?.has('change') ?? false;
  return <StartFlow key={change ? 'change' : 'start'} change={change} />;
}

function StartFlow({ change }: { change: boolean }) {
  const router = useRouter();
  const KEY = change ? 'fl-change' : 'fl-start';
  // Answers survive a refresh or a trip away from the page (this browser only), so nobody has to start over.
  // When changing, earlier answers are offered again (except days, which is what they came to change).
  const saved = useState(() => {
    try {
      const inProgress = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
      if (!change || Object.keys(inProgress).length) return inProgress;
      const prior = JSON.parse(localStorage.getItem('fl-answers') ?? '{}') as Record<string, unknown>;
      return { ...prior, days: 0, step: 0, comfort: prior.comfort ?? localStorage.getItem('fl-comfort') ?? '' };
    } catch { return {}; }
  })[0];
  const valid = <T,>(v: unknown, opts: Choice<T>[]): T | undefined => opts.find(o => o.id === v)?.id;
  const [step, setStep] = useState(() => Math.min(Number(saved.step) || 0, STEPS.length - 1));
  const [days, setDays] = useState(() => valid(saved.days, DAYS) ?? 0);
  const [exp, setExp] = useState<Experience | ''>(() => valid(saved.exp, EXP) ?? '');
  const [goal, setGoal] = useState<Goal | ''>(() => valid(saved.goal, GOALS) ?? '');
  const [mins, setMins] = useState<Minutes | 0>(() => valid(saved.mins, TIMES) ?? 0);
  const [comfort, setComfort] = useState<Comfort | ''>(() => valid(saved.comfort, COMFORTS) ?? '');
  const okList = <T extends string,>(v: unknown, opts: { id: T }[]) => (Array.isArray(v) ? v.filter((x): x is T => opts.some(o => o.id === x)) : []);
  const [focus, setFocus] = useState<Focus[]>(() => okList(saved.focus, FOCUSES).slice(0, 2));
  // Injuries in the person's own words; the body areas are read from the text.
  const [injury, setInjury] = useState<string>(() => (typeof saved.injury === 'string' ? saved.injury : ''));
  const areas = detectAreas(injury);
  // Pounds unless the person picks kilograms (here, or later in Settings).
  const [unit, setUnit] = useState<Unit>(() => (saved.unit === 'kg' || saved.unit === 'lb' ? saved.unit : change ? getUnit() : 'lb'));
  const [focusHint, setFocusHint] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ step, days, exp, goal, mins, comfort, focus, injury, unit })); } catch { /* optional */ } }, [KEY, step, days, exp, goal, mins, comfort, focus, injury, unit]);
  const [current, setCurrent] = useState<{ name: string; workouts: number; unfinished: boolean } | null>(null);
  useEffect(() => {
    if (!change) return;
    (async () => {
      try {
        const { data: plans } = await supabase.from('workout_plans').select('id, name, is_active').order('created_at');
        const cur = pickCurrent((plans ?? []) as { id: string; name: string; is_active: boolean | null }[], storedPlanId());
        if (!cur) return;
        const [{ count }, { data: open }, { data: prefs }] = await Promise.all([
          supabase.from('workout_days').select('id', { count: 'exact', head: true }).eq('plan_id', cur.id),
          supabase.from('workout_sessions').select('id').is('completed_at', null).limit(1),
          supabase.from('user_training_prefs').select('*').maybeSingle(),
        ]);
        setCurrent({ name: cur.name, workouts: count ?? 0, unfinished: (open ?? []).length > 0 });
        // Fill in what the account remembers if this device doesn't.
        const p = prefs as { comfort: string | null; session_minutes: number | null; pain_areas?: string[]; injury_notes?: string | null; focus?: string[] } | null;
        if (p?.comfort) setComfort(c => c || (valid(p.comfort, COMFORTS) ?? ''));
        const known = p?.injury_notes || (p?.pain_areas?.length ? AREAS.filter(a => p.pain_areas!.includes(a.id)).map(a => a.title.toLowerCase()).join(', ') : '');
        if (known) setInjury(i => i || known);
        if (p?.focus?.length) setFocus(f => (f.length ? f : okList(p.focus, FOCUSES).slice(0, 2)));
        if (p?.session_minutes) setMins(m => m || (TIMES.reduce((a, b) => Math.abs(b.id - p.session_minutes!) < Math.abs(a.id - p.session_minutes!) ? b : a).id));
      } catch { /* the questions still work without this */ }
    })();
  }, [change]);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const done = step >= STEPS.length;
  const rec = days && exp ? recommendPlan(days, exp) : null;
  const chosenId = picked || rec?.primary || '';
  const found = TEMPLATES.find(t => t.id === chosenId);
  const base = found && exp ? forExperience(found, exp) : found;
  const adapted = base && comfort ? applyComfort(base, comfort) : null;
  // Order: experience, comfort (which version of each lift), goal and time (what fits), then areas to
  // go easy on (so the note only talks about exercises that are really in the plan), then focus.
  const newer = exp === 'new' || exp === 'brand_new';
  const tailored = adapted && goal && mins ? tailorTemplate(adapted.tpl, goal, mins, { newer }) : null;
  const gentle = tailored ? applyAreas(tailored, areas) : null;
  const focused = gentle ? applyFocus(gentle.tpl, focus) : null;
  // Swaps and focus sets change the length a little: one last pass keeps every workout in the picked time.
  const tpl = focused && mins ? fitToTime(focused.tpl, mins as Minutes, n => inFocus(n, focus), { newer }) : null;
  const insteadOf = (name: string) => gentle?.swapped?.[name] ?? adapted?.swapped[name];

  function answer(setter: () => void) { setter(); setPicked(''); setTimeout(() => setStep(s => s + 1), 180); }

  async function create() {
    if (!tpl || busy) return;
    setBusy(true); setError('');
    const res = await createPlanFromTemplate(tpl);
    if ('error' in res) { setBusy(false); return setError('Could not create the plan: ' + res.error); }
    await setCurrentPlan(res.planId); // best effort beyond this device; the plan exists either way
    setUnitLocal(unit);
    try { localStorage.setItem('fl-comfort', comfort); localStorage.setItem('fl-answers', JSON.stringify({ exp, goal, mins, comfort, focus, unit })); localStorage.removeItem(KEY); } catch { /* optional */ }
    try { // best effort: the plan is already created even if preferences cannot be saved
      if (comfort) await savePrefs({ comfort, session_minutes: mins || null, pain_areas: areas, injury_notes: injury.trim() || null, focus, unit });
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
        {change && step === 0 && <div className="mb-2 text-xs uppercase tracking-wide text-fl-acc">Change training days</div>}
        <h1 className="mb-1 text-3xl font-bold leading-tight">{change && key === 'days' ? 'How many days per week can you train now?' : QUESTION[key][0]}</h1>
        <p className="mb-6 text-fl-tx2">{change && key === 'days' && current
          ? `Your current plan, ${current.name}, has ${current.workouts} ${current.workouts === 1 ? 'workout' : 'workouts'}. Pick what fits your week now. Everything you've logged stays.`
          : change && step > 0 ? 'Your earlier answer is selected. Tap it to keep it, or pick another.' : QUESTION[key][1]}</p>
        <div className="space-y-3">
          {key === 'days' && DAYS.map(c => <Card key={c.id} c={c} on={days === c.id} pick={v => answer(() => setDays(v))} />)}
          {key === 'experience' && EXP.map(c => <Card key={c.id} c={c} on={exp === c.id} pick={v => answer(() => setExp(v))} />)}
          {key === 'goal' && GOALS.map(c => <Card key={c.id} c={c} on={goal === c.id} pick={v => answer(() => setGoal(v))} />)}
          {key === 'time' && TIMES.map(c => <Card key={c.id} c={c} on={mins === c.id} pick={v => answer(() => setMins(v))} />)}
          {key === 'comfort' && COMFORTS.map(c => <Card key={c.id} c={c} on={comfort === c.id} pick={v => answer(() => setComfort(v))} />)}
          {key === 'focus' && <>
            {FOCUSES.map(f => <Toggle key={f.id} title={f.title} sub={f.sub} on={focus.includes(f.id)}
              toggle={() => {
                if (focus.includes(f.id)) { setFocus(focus.filter(y => y !== f.id)); setFocusHint(false); }
                else if (focus.length >= 2) setFocusHint(true);
                else { setFocus([...focus, f.id]); setFocusHint(false); }
              }} />)}
            <Toggle title="Keep it balanced" sub="No extra focus; everything gets the same attention" on={focus.length === 0} toggle={() => { setFocus([]); setFocusHint(false); }} />
            {focusHint && <p role="status" className="text-sm text-fl-tx2">Pick up to two. Tap one to remove it first.</p>}
            <button onClick={() => setStep(s => s + 1)} className="h-14 w-full rounded-xl bg-fl-acc text-lg font-bold text-fl-on-acc">Continue</button>
          </>}
          {key === 'areas' && <>
            <label className="block">
              <span className="sr-only">Known injuries</span>
              <textarea value={injury} onChange={e => setInjury(e.target.value.slice(0, 300))} rows={3} maxLength={300}
                placeholder="For example: bad left knee" className="w-full rounded-2xl border border-fl-field bg-fl-s1 p-4 text-base text-fl-tx placeholder:text-fl-tx2" />
            </label>
            {injury.trim() !== '' && (areas.length
              ? <p role="status" className="text-sm"><span className="font-semibold">We&apos;ll go easy on:</span> {AREAS.filter(a => areas.includes(a.id)).map(a => a.title.toLowerCase()).join(', ')}</p>
              : !/^\s*(no|none|nothing|nope|n\/?a)\s*[.!]?\s*$/i.test(injury) && <p role="status" className="text-sm text-fl-tx2">We couldn&apos;t match that to a body area, so your exercises won&apos;t change. You can swap any exercise that bothers you.</p>)}
            <div className="rounded-2xl border border-fl-line bg-fl-s1 p-4 text-sm leading-relaxed text-fl-tx2">
              <span className="font-semibold text-fl-tx">Rest comes first.</span> If an injury is recent, painful or still healing, give it time and check with a doctor or physical therapist before training it. Forgeload doesn&apos;t diagnose or treat injuries.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setInjury(''); setStep(s => s + 1); }} className="h-14 rounded-xl border border-fl-field bg-fl-s1 text-lg font-semibold">None</button>
              <button onClick={() => setStep(s => s + 1)} disabled={!injury.trim()} className="h-14 rounded-xl bg-fl-acc text-lg font-bold text-fl-on-acc disabled:opacity-50">Continue</button>
            </div>
          </>}
        </div>
        <div className="mt-6 flex items-center justify-between text-sm">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="h-11 px-2 text-fl-tx2">← Back</button> : <span />}
          <Link href="/plan" className="text-fl-tx2 underline-offset-2 hover:underline">{change ? 'Keep my current plan' : 'Build it myself instead'}</Link>
        </div>
      </main>
    );
  }

  const chips = [`${days} ${days === 1 ? "day" : "days"} a week`, EXP.find(e => e.id === exp)?.title, GOALS.find(g => g.id === goal)?.title, ...(focus.length ? FOCUSES.filter(f => focus.includes(f.id)).map(f => `More ${f.title.toLowerCase()}`) : ['Balanced']), TIMES.find(t => t.id === mins)?.title, COMFORTS.find(c => c.id === comfort)?.title, ...(areas.length ? [`Go easy: ${AREAS.filter(a => areas.includes(a.id)).map(a => a.title.toLowerCase()).join(', ')}`] : injury.trim() && !/^\s*(no|none|nothing|nope|n\/?a)\s*[.!]?\s*$/i.test(injury) ? ['Injury noted'] : [])];
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
          <p className="mb-4 text-fl-tx2">{blurbFor(tpl, days || tpl.days.length)}</p>
          <div className="mb-4 space-y-2 rounded-2xl bg-fl-s1 border border-fl-line p-4 text-sm leading-relaxed text-fl-tx2">
            <p><span className="font-semibold text-fl-tx">Why this split. </span>{rec.why}</p>
            <p><span className="font-semibold text-fl-tx">Your goal. </span>{GOAL_NOTE[goal as Goal]}</p>
            <p><span className="font-semibold text-fl-tx">Your time. </span>{newer && mins === 75 ? 'Every exercise, about an hour with warm-up. While you\'re new we cap it at about 20 sets a workout: recovery matters more than extra sets, so use the spare time for longer rests.' : TIME_NOTE[mins as Minutes]}</p>
            {adapted && adapted.notes.length > 0 && <p><span className="font-semibold text-fl-tx">Your comfort. </span>{adapted.notes.join(' ')}</p>}
            {focused && focused.notes.length > 0 && <p><span className="font-semibold text-fl-tx">Your focus. </span>{focused.notes.join(' ')}</p>}
            {gentle && gentle.notes.length > 0 && <p><span className="font-semibold text-fl-tx">Going easy. </span>{gentle.notes.join(' ')}</p>}
          </div>
          <div className="mb-4 space-y-3">
            {tpl.days.map((d, i) => (
              <details key={i} className="rounded-2xl bg-fl-s1 border border-fl-line px-4 py-3" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="font-semibold">{d.name}</span><span className="text-sm text-fl-tx2">{d.exercises.length} exercises</span>
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.exercises.map((e, j) => <li key={j} className="flex justify-between gap-3"><span>{e[0]}{insteadOf(e[0]) && <span className="block text-xs text-fl-tx2">Instead of {insteadOf(e[0])}</span>}</span><span className="shrink-0 text-fl-tx2">{e[1]} × {e[2]}-{e[3]}</span></li>)}
                </ul>
              </details>
            ))}
          </div>
          {change && current && current.name === tpl.name && (
            <div className="mb-4 rounded-2xl border border-fl-acc/60 bg-fl-tint p-4 text-sm leading-relaxed">
              <p className="font-semibold">This is the same kind of plan you have now.</p>
              <p className="mt-1 text-fl-tx2">Training {days} {days === 1 ? 'day' : 'days'} a week doesn&apos;t change the workouts, only how often you do them: you just do the next one each time. You can keep your current plan. Switch only if you changed other answers and want them used.</p>
            </div>
          )}
          {change && current && current.name !== tpl.name && (
            <div className="mb-4 rounded-2xl border border-fl-field bg-fl-s2 p-4 text-sm leading-relaxed">
              <p className="font-semibold">You&apos;ll switch from {current.name} ({current.workouts} {current.workouts === 1 ? 'workout' : 'workouts'}) to {tpl.name} ({tpl.days.length} {tpl.days.length === 1 ? 'workout' : 'workouts'}).</p>
              <p className="mt-1 text-fl-tx2">You start at workout 1 of the new plan. Your old plan and everything you&apos;ve logged are kept, and your weights carry over to the same exercises. You can switch back any time on the Plan tab.</p>
            </div>
          )}
          {change && current?.unfinished && (
            <p role="alert" className="mb-3 text-sm text-fl-bad">⚠ You have an unfinished workout. <Link href="/log" className="underline">Finish or discard it</Link> before switching plans.</p>
          )}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-fl-line bg-fl-s1 px-4 py-3">
            <span className="font-semibold">Weights in</span>
            <div role="radiogroup" aria-label="Weight unit" className="flex rounded-xl bg-fl-s2 p-1">
              {(['lb', 'kg'] as const).map(u => (
                <button key={u} role="radio" aria-checked={unit === u} onClick={() => setUnit(u)}
                  className={`h-10 w-16 rounded-lg text-sm font-semibold ${unit === u ? 'bg-fl-s1 text-fl-tx shadow' : 'text-fl-tx2'}`}>{u === 'lb' ? 'Pounds' : 'Kilos'}</button>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-fl-bad">{error}</p>}
          <button onClick={create} disabled={busy || (change && !!current?.unfinished)} className="h-14 w-full rounded-xl bg-fl-acc text-lg font-bold text-fl-on-acc disabled:opacity-60">
            {busy ? (change ? 'Switching...' : 'Creating...') : change ? 'Switch to this plan' : 'Create this plan'}
          </button>
          <p className="mt-2 text-center text-xs text-fl-tx2">{change ? <Link href="/plan" className="underline-offset-2 hover:underline">Keep my current plan</Link> : 'You can rename days and swap any exercise afterward.'}</p>
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
