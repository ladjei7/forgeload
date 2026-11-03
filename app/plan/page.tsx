'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import ExercisePicker from '../components/ExercisePicker';
import { logEvent } from '../lib/events';
import { TEMPLATES } from '../lib/templates';
import { createPlanFromTemplate } from '../lib/applyTemplate';


type Plan = { id: string; name: string };
type Day = { id: string; day_name: string; sort_order: number };
type PlanEx = { id: string; exercise_name: string; exercise_id: string | null; target_sets: number; rep_min: number; rep_max: number };

const card = { background: '#111', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' } as const;
const input = { width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px' } as const;
const btn = { width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#fff', color: '#000', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', border: 'none' } as const;
const h2 = { fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.75rem' } as const;

export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
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
  const [message, setMessage] = useState('');
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
  useEffect(() => { if (planId) loadDays(planId); else { setDays([]); setDayId(''); } }, [planId]);
  useEffect(() => { if (dayId) loadExercises(dayId); else setExercises([]); }, [dayId]);

  async function loadPlans() {
  const { data } = await supabase.from('workout_plans').select('id, name').order('created_at');
  if (!data) return;
  setPlans(data);
  setPlanId(prev =>
    data.find(p => p.id === prev) ? prev : (data[data.length - 1]?.id ?? '')
  );
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
    const { data, error } = await supabase.from('workout_plans').insert([{ name: planName.trim() }]).select().single();
    if (error) return setMessage('Error: ' + error.message);
    setPlanName(''); await loadPlans(); setPlanId(data.id); setMessage('Plan created: ' + data.name);
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
    const res = await createPlanFromTemplate(tpl);
    setBusy(false);
    if ('error' in res) return setMessage('Error: ' + res.error);
    await loadPlans(); setPlanId(res.planId);
    setMessage(tpl.name + ' added. Rename days or swap exercises below to make it yours.');
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
    await supabase.from('plan_exercises').delete().eq('id', id); await loadExercises(dayId);
  }
  async function removeDay(id: string) {
    if (!confirm('Delete this day and all its exercises?')) return;
    await supabase.from('workout_days').delete().eq('id', id); await loadDays(planId);
  }
  async function removePlan(id: string) {
  if (!confirm('Delete this whole plan?')) return;
  await supabase.from('workout_plans').delete().eq('id', id);
  await loadPlans();
}

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Your Plan</h1>
      <Link href="/library" style={{ display: 'inline-block', marginBottom: '1rem', color: '#4ade80' }}>Browse exercise library →</Link>

      <div style={card}>
        <h2 style={h2}>Start from a template</h2>
        <select value={tplId} onChange={e => setTplId(e.target.value)} style={{ ...input, marginBottom: '0.5rem' }}>
          {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <p style={{ color: '#777', fontSize: '13px', marginBottom: '0.75rem' }}>{TEMPLATES.find(t => t.id === tplId)?.blurb}</p>
        <button onClick={applyTemplate} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Adding...' : 'Use This Template'}</button>
      </div>

      <div style={card}>
        <h2 style={h2}>Plan</h2>
        {plans.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <select value={planId} onChange={e => setPlanId(e.target.value)} style={input}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {planId && <button onClick={renamePlan} style={{ ...btn, width: 'auto', background: '#1a1a1a', color: '#fff' }}>Rename</button>}
            {planId && <button onClick={() => removePlan(planId)} style={{ ...btn, width: 'auto', background: '#2a1111', color: '#f87171' }}>Delete</button>}
          </div>
        )}
        <input style={{ ...input, marginBottom: '0.75rem' }} placeholder="New plan name (e.g. LURLPPR)" value={planName} onChange={e => setPlanName(e.target.value)} />
        <button onClick={createPlan} style={btn}>Create New Plan</button>
      </div>

      {planId && (
        <div style={card}>
          <h2 style={h2}>Days</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {days.map(d => (
              <button key={d.id} onClick={() => setDayId(d.id)} style={{ padding: '0.5rem 0.9rem', borderRadius: '999px', border: '1px solid #333', cursor: 'pointer', fontSize: '14px', background: d.id === dayId ? '#fff' : '#1a1a1a', color: d.id === dayId ? '#000' : '#fff' }}>
                {d.day_name}
              </button>
            ))}
            {days.length === 0 && <p style={{ color: '#666', fontSize: '14px' }}>No days yet.</p>}
          </div>
          <input style={{ ...input, marginBottom: '0.75rem' }} placeholder="New day (e.g. Tuesday - Upper)" value={dayName} onChange={e => setDayName(e.target.value)} />
          <button onClick={addDay} style={btn}>Add Day</button>
        </div>
      )}

      {dayId && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ ...h2, marginBottom: 0 }}>{days.find(d => d.id === dayId)?.day_name}</h2>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={renameDay} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px' }}>Rename</button>
              <button onClick={() => removeDay(dayId)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>Delete day</button>
            </div>
          </div>

          {exercises.map((ex, i) => (
            <div key={ex.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div onClick={() => (editId === ex.id ? setEditId('') : startEdit(ex))} style={{ cursor: 'pointer', minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '15px' }}>{ex.exercise_name}</div>
                  <div style={{ fontSize: '12px', color: '#777' }}>{ex.target_sets} sets × {ex.rep_min}-{ex.rep_max} reps · tap to edit</div>
                </div>
                <button onClick={() => moveExercise(i, -1)} disabled={i === 0} aria-label="Move up" style={{ background: 'none', border: 'none', color: i === 0 ? '#333' : '#aaa', cursor: 'pointer', fontSize: '16px' }}>▲</button>
                <button onClick={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} aria-label="Move down" style={{ background: 'none', border: 'none', color: i === exercises.length - 1 ? '#333' : '#aaa', cursor: 'pointer', fontSize: '16px' }}>▼</button>
                <button onClick={() => removeExercise(ex.id)} aria-label="Remove" style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px' }}>✕</button>
              </div>
              {editId === ex.id && (
                <div style={{ marginTop: '0.6rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {[['Sets', editSets, setEditSets], ['Min reps', editMin, setEditMin], ['Max reps', editMax, setEditMax]].map(([label, value, set]) => (
                      <div key={label as string} style={{ minWidth: 0 }}>
                        <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '4px' }}>{label as string}</label>
                        <input type="number" style={input} value={value as string} onChange={e => (set as (v: string) => void)(e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <button onClick={saveEdit} style={btn}>Save</button>
                  {repFor === ex.id ? (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>Replace {ex.exercise_name} with:</div>
                      <ExercisePicker value={repName} onChange={setRepName} onPick={x => setRepId(x?.id ?? '')} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => replaceExercise(ex)} style={{ ...btn, background: '#4ade80' }}>Replace</button>
                        <button onClick={() => { setRepFor(''); setRepName(''); setRepId(''); }} style={{ ...btn, background: '#222', color: '#fff' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setRepFor(ex.id); setRepName(''); setRepId(''); }} style={{ ...btn, background: '#222', color: '#fff', marginTop: '0.5rem' }}>Replace this exercise</button>
                  )}
                </div>
              )}
            </div>
          ))}
          {exercises.length === 0 && <p style={{ color: '#666', fontSize: '14px', marginBottom: '0.75rem' }}>No exercises yet.</p>}

          <div style={{ marginTop: '1rem' }}>
            <ExercisePicker value={exerciseName} onChange={setExerciseName} onPick={ex => setExerciseId(ex?.id ?? '')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[['Sets', sets, setSets], ['Min reps', repMin, setRepMin], ['Max reps', repMax, setRepMax]].map(([label, value, set]) => (
                <div key={label as string} style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '4px' }}>{label as string}</label>
                  <input type="number" style={input} value={value as string} onChange={e => (set as (v: string) => void)(e.target.value)} />
                </div>
              ))}
            </div>
            <button onClick={addExercise} style={btn}>Add Exercise</button>
          </div>
        </div>
      )}

      {undo && <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '1rem', color: '#4ade80', fontSize: '14px', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}><span>{undo.label}</span><button onClick={undoReplace} style={{ background: 'none', border: '1px solid #4ade80', color: '#4ade80', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', flexShrink: 0 }}>Undo</button></div>}
      {message && <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '1rem', color: '#4ade80', fontSize: '14px' }}>{message}</div>}
    </main>
  );
}