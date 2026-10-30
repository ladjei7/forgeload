'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import ExercisePicker from '../components/ExercisePicker';

type Plan = { id: string; name: string };
type Day = { id: string; day_name: string; sort_order: number };
type PlanEx = { id: string; exercise_name: string; target_sets: number; rep_min: number; rep_max: number };

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
  const [sets, setSets] = useState('');
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { loadPlans(); }, []);
  useEffect(() => { if (planId) loadDays(planId); else { setDays([]); setDayId(''); } }, [planId]);
  useEffect(() => { if (dayId) loadExercises(dayId); else setExercises([]); }, [dayId]);

  async function loadPlans() {
    const { data } = await supabase.from('workout_plans').select('id, name').order('created_at');
    if (data) { setPlans(data); if (data.length && !planId) setPlanId(data[data.length - 1].id); }
  }
  async function loadDays(id: string) {
    const { data } = await supabase.from('workout_days').select('id, day_name, sort_order').eq('plan_id', id).order('sort_order');
    if (data) { setDays(data); if (!data.find(d => d.id === dayId)) setDayId(data[0]?.id ?? ''); }
  }
  async function loadExercises(id: string) {
    const { data } = await supabase.from('plan_exercises').select('id, exercise_name, target_sets, rep_min, rep_max').eq('workout_day_id', id).order('sort_order');
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
    const { error } = await supabase.from('plan_exercises').insert([{
      workout_day_id: dayId, exercise_name: exerciseName.trim(),
      target_sets: parseInt(sets), rep_min: parseInt(repMin), rep_max: parseInt(repMax), sort_order: exercises.length,
    }]);
    if (error) return setMessage('Error: ' + error.message);
    setMessage('Added: ' + exerciseName); setExerciseName(''); await loadExercises(dayId);
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
    await supabase.from('workout_plans').delete().eq('id', id); setPlanId(''); await loadPlans();
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Your Plan</h1>

      <div style={card}>
        <h2 style={h2}>Plan</h2>
        {plans.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <select value={planId} onChange={e => setPlanId(e.target.value)} style={input}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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
            <button onClick={() => removeDay(dayId)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>Delete day</button>
          </div>

          {exercises.map(ex => (
            <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #222' }}>
              <div>
                <div style={{ fontSize: '15px' }}>{ex.exercise_name}</div>
                <div style={{ fontSize: '12px', color: '#777' }}>{ex.target_sets} sets × {ex.rep_min}-{ex.rep_max} reps</div>
              </div>
              <button onClick={() => removeExercise(ex.id)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
          ))}
          {exercises.length === 0 && <p style={{ color: '#666', fontSize: '14px', marginBottom: '0.75rem' }}>No exercises yet.</p>}

          <div style={{ marginTop: '1rem' }}>
            <ExercisePicker value={exerciseName} onChange={setExerciseName} />
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

      {message && <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '1rem', color: '#4ade80', fontSize: '14px' }}>{message}</div>}
    </main>
  );
}