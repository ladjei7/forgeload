'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import ExercisePicker from '../components/ExercisePicker';
import HowTo from '../components/HowTo';
import { pickCurrent, setCurrentPlan, storedPlanId } from '../lib/currentPlan';
import { logEvent } from '../lib/events';
import { TEMPLATES } from '../lib/templates';
import { createPlanFromTemplate } from '../lib/applyTemplate';
import { applyComfort, type Comfort } from '../lib/comfort';
import { ui, Icon, Notice } from '../components/ui';


type Plan = { id: string; name: string; is_active?: boolean | null };
type Day = { id: string; day_name: string; sort_order: number };
type PlanEx = { id: string; exercise_name: string; exercise_id: string | null; target_sets: number; rep_min: number; rep_max: number };


export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [days, setDays] = useState<Day[]>([]);
  const [dayId, setDayId] = useState('');
  const [exercises, setExercises] = useState<PlanEx[]>([]);
  const [planName, setPlanName] = useState('');
  const [dayName, setDayName] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [sets, setSets] = useState('');
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Problems ("Error: ...", missing or wrong input) show in red; everything else is a confirmation.
  const setMessage = (text: string) => setMsg(text ? { kind: /^Error|^Fill in|^Check the|^Pick an|same exercise|could not be saved/.test(text) ? 'error' : 'ok', text: text.replace(/^Error: /, 'Something went wrong: ') } : null);
  useEffect(() => { if (msg?.kind !== 'ok') return; const t = setTimeout(() => setMsg(null), 6000); return () => clearTimeout(t); }, [msg]);
  const [tplId, setTplId] = useState(TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const [repFor, setRepFor] = useState(''); // plan exercise being replaced
  const [repName, setRepName] = useState('');
  const [repId, setRepId] = useState('');
  const [undo, setUndo] = useState<{ rowId: string; name: string; id: string | null; label: string } | null>(null);

  useEffect(() => { loadPlans(); }, []);
  // With no plan or no workout selected, those sections are hidden, so nothing needs resetting here.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the loaders only call state setters
  useEffect(() => { if (planId) void loadDays(planId); }, [planId]);
  useEffect(() => { if (dayId) void loadExercises(dayId); }, [dayId]);

  async function loadPlans() {
  const { data } = await supabase.from('workout_plans').select('id, name, is_active').order('created_at');
  if (!data) return;
  setPlans(data);
  const cur = pickCurrent(data as Plan[], storedPlanId())?.id ?? '';
  setCurrentId(cur);
  setPlanId(prev => (data.find(p => p.id === prev) ? prev : cur));
}
  async function loadDays(id: string) {
    const { data } = await supabase.from('workout_days').select('id, day_name, sort_order').eq('plan_id', id).order('sort_order');
    if (data) { setDays(data); if (!data.find(d => d.id === dayId)) setDayId(data[0]?.id ?? ''); }
  }
  async function loadExercises(id: string) {
    const { data } = await supabase.from('plan_exercises').select('id, exercise_name, exercise_id, target_sets, rep_min, rep_max').eq('workout_day_id', id).order('sort_order');
    if (data) setExercises(data);
  }

  async function createPlan() {
    if (!planName.trim()) return;
    const { data, error } = await supabase.from('workout_plans').insert([{ name: planName.trim(), is_active: plans.length === 0 }]).select().single();
    if (error) return setMessage('Error: ' + error.message);
    setPlanName(''); await loadPlans(); setPlanId(data.id); setMessage(plans.length === 0 ? 'Plan created: ' + data.name : `Plan created: ${data.name}. Your current plan is unchanged until you tap "Make this my current plan".`);
  }
  async function addDay() {
    if (!dayName.trim() || !planId) return;
    const { data, error } = await supabase.from('workout_days').insert([{ plan_id: planId, day_name: dayName.trim(), sort_order: days.length }]).select().single();
    if (error) return setMessage('Error: ' + error.message);
    setDayName(''); await loadDays(planId); setDayId(data.id); setMessage('Day added: ' + data.day_name);
  }
  async function addExercise() {
    if (!exerciseName.trim() || !dayId || !sets || !repMin || !repMax) return setMessage('Fill in the exercise, sets, min reps, and max reps.');
    // If the name was typed (or edited) without tapping a result, link it when it exactly matches
    // one exercise the user can see. Never guess: no exact match means no link.
    let linkId = exerciseId;
    if (!linkId) {
      const want = exerciseName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const { data: hits } = await supabase.rpc('search_exercises', { q: exerciseName.trim(), lim: 10 });
      const exact = ((hits ?? []) as { id: string; name: string }[]).filter(h => h.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === want);
      if (exact.length === 1) linkId = exact[0].id;
    }
    const { error } = await supabase.from('plan_exercises').insert([{
      workout_day_id: dayId, exercise_name: exerciseName.trim(), exercise_id: linkId || null,
      target_sets: parseInt(sets), rep_min: parseInt(repMin), rep_max: parseInt(repMax), sort_order: exercises.length,
    }]);
    if (error) return setMessage('Error: ' + error.message);
    if (linkId) supabase.rpc('touch_exercise', { ex: linkId }).then(() => {}, () => {}); // recents; failure is harmless
    setMessage('Added: ' + exerciseName); setExerciseName(''); setExerciseId(''); await loadExercises(dayId);
  }
  async function applyTemplate() {
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl || busy) return;
    setBusy(true);
    // Same rule as onboarding: start with the versions of each lift the person is comfortable with.
    // No saved answer means "not sure": machines and dumbbells, barbells only when chosen.
    let comfort: Comfort = 'unsure';
    try {
      const { data } = await supabase.from('user_training_prefs').select('comfort').maybeSingle();
      const c = (data?.comfort ?? localStorage.getItem('fl-comfort')) as Comfort | null;
      if (c === 'machines' || c === 'mixed' || c === 'all' || c === 'unsure') comfort = c;
    } catch { /* keep the safe default */ }
    const res = await createPlanFromTemplate(applyComfort(tpl, comfort).tpl, { current: plans.length === 0 });
    setBusy(false);
    if ('error' in res) return setMessage('Error: ' + res.error);
    await loadPlans(); setPlanId(res.planId);
    setMessage(tpl.name + ' added' + (comfort === 'all' ? '' : ', using exercises that match your comfort setting') + '. Rename days or swap exercises below to make it yours.' + (plans.length ? ' Your current plan is unchanged until you tap "Make this my current plan".' : ''));
  }
  async function makeCurrent() {
    const ok = await setCurrentPlan(planId);
    setCurrentId(planId);
    setMessage(ok ? `${plans.find(p => p.id === planId)?.name} is now your current plan. Your history is unchanged.` : 'Switched on this device, but it could not be saved to your account. Check your connection and try again.');
  }
  async function renamePlan() {
    const cur = plans.find(p => p.id === planId);
    const name = prompt('Rename plan', cur?.name ?? '')?.trim();
    if (!name || name === cur?.name) return;
    const { error } = await supabase.from('workout_plans').update({ name }).eq('id', planId);
    if (error) return setMessage('Error: ' + error.message);
    await loadPlans();
  }
  async function renameDay() {
    const cur = days.find(d => d.id === dayId);
    const name = prompt('Rename day', cur?.day_name ?? '')?.trim();
    if (!name || name === cur?.day_name) return;
    const { error } = await supabase.from('workout_days').update({ day_name: name }).eq('id', dayId);
    if (error) return setMessage('Error: ' + error.message);
    await loadDays(planId);
  }
  function startEdit(ex: PlanEx) {
    setEditId(ex.id); setEditSets(String(ex.target_sets)); setEditMin(String(ex.rep_min)); setEditMax(String(ex.rep_max));
  }
  async function saveEdit() {
    const s = parseInt(editSets), mn = parseInt(editMin), mx = parseInt(editMax);
    if (!s || !mn || !mx || mn > mx) return setMessage('Check the numbers: min reps must be at most max reps.');
    const { error } = await supabase.from('plan_exercises').update({ target_sets: s, rep_min: mn, rep_max: mx }).eq('id', editId);
    if (error) return setMessage('Error: ' + error.message);
    setEditId(''); await loadExercises(dayId);
  }
  // Replace keeps the row's sets and reps. Past workouts keep the exercise they were logged with, so history is never rewritten.
  async function replaceExercise(ex: PlanEx) {
    if (!repId) return setMessage('Pick an exercise from the list to replace it with.');
    if (repId === ex.exercise_id) return setMessage('That is the same exercise.');
    const { error } = await supabase.from('plan_exercises').update({ exercise_name: repName.trim(), exercise_id: repId }).eq('id', ex.id);
    if (error) return setMessage('Error: ' + error.message);
    logEvent('swap', { from: { id: ex.exercise_id, name: ex.exercise_name }, to: { id: repId, name: repName.trim() }, scope: 'plan' });
    setUndo({ rowId: ex.id, name: ex.exercise_name, id: ex.exercise_id, label: `Replaced ${ex.exercise_name} with ${repName.trim()}. Your past sets stay in your history.` });
    setRepFor(''); setRepName(''); setRepId(''); setEditId(''); setMessage(''); await loadExercises(dayId);
  }
  async function undoReplace() {
    if (!undo) return;
    const { error } = await supabase.from('plan_exercises').update({ exercise_name: undo.name, exercise_id: undo.id }).eq('id', undo.rowId);
    if (error) return setMessage('Error: ' + error.message);
    setUndo(null); await loadExercises(dayId);
  }
  async function moveExercise(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= exercises.length) return;
    const next = [...exercises];
    [next[index], next[j]] = [next[j], next[index]];
    setExercises(next);
    await Promise.all(next.map((ex, i) => supabase.from('plan_exercises').update({ sort_order: i }).eq('id', ex.id)));
  }
  async function removeExercise(id: string) {
    const name = exercises.find(e => e.id === id)?.exercise_name ?? 'this exercise';
    if (!confirm(`Remove ${name} from this workout? Sets you already logged stay in your History.`)) return;
    setEditId('');
    await supabase.from('plan_exercises').delete().eq('id', id); await loadExercises(dayId);
  }
  async function removeDay(id: string) {
    const name = days.find(d => d.id === id)?.day_name ?? 'this workout';
    if (!confirm(`Remove ${name} from this plan? Workouts you already did stay in your History.`)) return;
    await supabase.from('workout_days').delete().eq('id', id); await loadDays(planId);
  }
  async function removePlan(id: string) {
  if (!confirm('Delete this whole plan?')) return;
  await supabase.from('workout_plans').delete().eq('id', id);
  await loadPlans();
}

  const plan = plans.find(p => p.id === planId);
  const day = days.find(d => d.id === dayId);
  const numberFields = (vals: [string, string, (v: string) => void][]) => (
    <div className="grid grid-cols-3 gap-2">
      {vals.map(([label, value, set]) => (
        <label key={label} className="min-w-0">
          <span className={ui.label}>{label}</span>
          <input type="number" inputMode="numeric" className={ui.input} value={value} onChange={e => set(e.target.value)} />
        </label>
      ))}
    </div>
  );

  return (
    <main className={ui.main}>
      <h1 className={ui.h1}>Your plan</h1>

      {plans.length === 0 ? (
        <section className={`${ui.card} mt-5`}>
          <h2 className={ui.h2}>No plan yet</h2>
          <p className={`${ui.sub} mb-4 mt-1`}>Answer a few quick questions and we&apos;ll build one that fits your week. Or start from a template below.</p>
          <Link href="/start" className={ui.primary}>Build my plan</Link>
        </section>
      ) : (
        <>
          {/* Which plan */}
          <div className="mb-5 mt-1">
            {plans.length > 1 ? (
              <label className="mt-3 block">
                <span className="sr-only">Plan</span>
                <select value={planId} onChange={e => setPlanId(e.target.value)} className={ui.input}>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.id === currentId ? ' (current)' : ''}</option>)}
                </select>
              </label>
            ) : <p className="text-fl-tx2">{plan?.name}</p>}
            {plans.length > 1 && planId && (planId === currentId
              ? <p className="mt-2 flex items-center gap-1.5 text-sm text-fl-tx2"><Icon name="check" size={16} className="text-fl-ok" /> This is your current plan. Home and Log follow it.</p>
              : <button onClick={makeCurrent} className={`${ui.secondary} mt-3`}>Make this my current plan</button>)}
            {planId && (
              <div className="-ml-2 mt-1 flex gap-1">
                <button onClick={renamePlan} className={ui.textBtn}>Rename plan</button>
                <button onClick={() => removePlan(planId)} className={ui.dangerText}>Delete plan</button>
              </div>
            )}
          </div>

          {/* Workouts in the plan */}
          {planId && (
            <section className={ui.card}>
              <h2 className={ui.h2}>Workouts</h2>
              <p className={`${ui.sub} mb-3`}>They rotate in this order. Tap one to see or change its exercises.</p>
              <div className="flex flex-wrap gap-2">
                {days.map(d => (
                  <button key={d.id} onClick={() => setDayId(d.id)} aria-pressed={d.id === dayId}
                    className={`${ui.pill} ${d.id === dayId ? ui.pillOn : ui.pillOff}`}>{d.day_name}</button>
                ))}
                {days.length === 0 && <p className={ui.sub}>No workouts yet. Add one below.</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">New workout name</span>
                  <input className={ui.input} placeholder="New workout, e.g. Push" value={dayName} onChange={e => setDayName(e.target.value)} />
                </label>
                <button onClick={addDay} className={ui.secondaryInline}>Add</button>
              </div>
            </section>
          )}

          {/* The selected workout */}
          {day && (
            <section className={`${ui.card} mt-4`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold">{day.day_name}</h2>
                <div className="-mr-2 flex">
                  <button onClick={renameDay} className={ui.textBtn}>Rename</button>
                  <button onClick={() => removeDay(dayId)} className={ui.dangerText}>Remove</button>
                </div>
              </div>

              <ul className="mt-2 divide-y divide-fl-line">
                {exercises.map((ex, i) => (
                  <li key={ex.id} className="py-3">
                    <button onClick={() => (editId === ex.id ? setEditId('') : startEdit(ex))} aria-expanded={editId === ex.id}
                      className="flex w-full items-center gap-3 py-1 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{ex.exercise_name}</span>
                        <span className="block text-sm text-fl-tx2">{ex.target_sets} sets × {ex.rep_min}-{ex.rep_max} reps</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-fl-tx2">{editId === ex.id ? 'Close' : 'Edit'}</span>
                    </button>
                    <HowTo key={ex.exercise_id ?? ex.exercise_name} name={ex.exercise_name} exerciseId={ex.exercise_id} info={ex.exercise_id ? undefined : null} compact />
                    {editId === ex.id && (
                      <div className="mt-3 space-y-2 rounded-xl bg-fl-s2/50 p-3">
                        {numberFields([['Sets', editSets, setEditSets], ['Min reps', editMin, setEditMin], ['Max reps', editMax, setEditMax]])}
                        <button onClick={saveEdit} className={ui.primary}>Save</button>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button onClick={() => moveExercise(i, -1)} disabled={i === 0} className={ui.chip}><Icon name="up" size={16} /> Move up</button>
                          <button onClick={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} className={ui.chip}><Icon name="down" size={16} /> Move down</button>
                          <button onClick={() => removeExercise(ex.id)} className={`${ui.chip} ml-auto text-fl-bad`}>Remove</button>
                        </div>
                        {repFor === ex.id ? (
                          <div className="pt-2">
                            <p className="mb-2 text-sm text-fl-tx2">Replace {ex.exercise_name} with:</p>
                            <ExercisePicker value={repName} onChange={setRepName} onPick={x => setRepId(x?.id ?? '')} />
                            <div className="flex gap-2">
                              <button onClick={() => replaceExercise(ex)} className={ui.primary}>Replace</button>
                              <button onClick={() => { setRepFor(''); setRepName(''); setRepId(''); }} className={ui.secondary}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setRepFor(ex.id); setRepName(''); setRepId(''); }} className={ui.secondary}>Replace this exercise</button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {exercises.length === 0 && <p className={`${ui.sub} py-2`}>No exercises yet.</p>}

              <div className="mt-4 space-y-2 border-t border-fl-line pt-4">
                <h3 className="font-semibold">Add an exercise</h3>
                <ExercisePicker value={exerciseName} onChange={setExerciseName} onPick={ex => setExerciseId(ex?.id ?? '')} />
                {numberFields([['Sets', sets, setSets], ['Min reps', repMin, setRepMin], ['Max reps', repMax, setRepMax]])}
                <button onClick={addExercise} className={ui.primary}>Add exercise</button>
              </div>
            </section>
          )}
        </>
      )}

      {/* Changing plans: less frequent, so it sits below the plan itself */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-fl-tx2">Change your plan</h2>
      <div className="space-y-4">
        {currentId && (
          <section className={ui.card}>
            <h3 className={ui.h2}>Training days</h3>
            <p className={`${ui.sub} mb-4 mt-1`}>
              Your current plan is {plans.find(p => p.id === currentId)?.name}. Want to train more or fewer days? We&apos;ll build a new plan and keep everything you&apos;ve logged.
            </p>
            <Link href="/start?change=1" className={ui.secondary}>Change training days</Link>
          </section>
        )}

        <section className={ui.card}>
          <h3 className={ui.h2}>Start from a template</h3>
          <label className="mt-3 block">
            <span className="sr-only">Template</span>
            <select value={tplId} onChange={e => setTplId(e.target.value)} className={ui.input}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <p className={`${ui.sub} mb-4 mt-2`}>{TEMPLATES.find(t => t.id === tplId)?.blurb}</p>
          <button onClick={applyTemplate} disabled={busy} className={ui.secondary}>{busy ? 'Adding...' : 'Add this template'}</button>
        </section>

        <section className={ui.card}>
          <h3 className={ui.h2}>Build a plan from scratch</h3>
          <div className="mt-3 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">New plan name</span>
              <input className={ui.input} placeholder="Plan name, e.g. My split" value={planName} onChange={e => setPlanName(e.target.value)} />
            </label>
            <button onClick={createPlan} className={ui.secondaryInline}>Create</button>
          </div>
        </section>

        <Link href="/library" className="flex h-12 items-center justify-center gap-1.5 font-semibold text-fl-acc">
          Browse the exercise library <Icon name="arrowRight" size={18} />
        </Link>
      </div>

      {(undo || msg) && (
        <div className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[90] mx-auto max-w-xl space-y-2">
          {undo && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-fl-line bg-fl-s1 p-3 text-sm shadow-lg">
              <span>{undo.label}</span>
              <button onClick={undoReplace} className="h-10 shrink-0 rounded-lg border border-fl-acc px-3 font-semibold text-fl-acc">Undo</button>
            </div>
          )}
          <div className="shadow-lg"><Notice msg={msg} /></div>
        </div>
      )}
    </main>
  );
}
