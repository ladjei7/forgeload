'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Exercise = {
  id: string;
  exercise_name: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
};

type SetLog = {
  setNumber: number;
  reps: string;
  weight: string;
};

type WorkoutDay = {
  id: string;
  day_name: string;
};

export default function LogPage() {
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sets, setSets] = useState<Record<string, SetLog[]>>({});
  const [lastSession, setLastSession] = useState<Record<string, SetLog[]>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDays();
  }, []);

  async function loadDays() {
    const { data } = await supabase
      .from('workout_days')
      .select('id, day_name')
      .order('sort_order');
    if (data) setDays(data);
  }

  async function startSession() {
    if (!selectedDayId) return;
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert([{ workout_day_id: selectedDayId, session_date: new Date().toISOString().slice(0, 10) }])
      .select().single();
    if (!session) return;
    setSessionId(session.id);

    const { data: exData } = await supabase
      .from('plan_exercises')
      .select('*')
      .eq('workout_day_id', selectedDayId)
      .order('sort_order');
    if (exData) {
      setExercises(exData);
      const initialSets: Record<string, SetLog[]> = {};
      exData.forEach((ex: Exercise) => {
        initialSets[ex.id] = Array.from({ length: ex.target_sets }, (_, i) => ({
          setNumber: i + 1, reps: '', weight: ''
        }));
      });
      setSets(initialSets);
      await loadLastSession(selectedDayId, exData);
    }
  }

  async function loadLastSession(dayId: string, exList: Exercise[]) {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('workout_day_id', dayId)
      .order('session_date', { ascending: false })
      .limit(2);
    if (!sessions || sessions.length < 2) return;
    const lastSessionId = sessions[1].id;
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('id, exercise_name, exercise_sets(*)')
      .eq('workout_session_id', lastSessionId);
    if (!logs) return;
    const lastData: Record<string, SetLog[]> = {};
    exList.forEach((ex: Exercise) => {
      const log = logs.find((l: any) => l.exercise_name === ex.exercise_name);
      if (log && log.exercise_sets) {
        lastData[ex.id] = log.exercise_sets.map((s: any) => ({
          setNumber: s.set_number, reps: String(s.reps), weight: String(s.weight)
        }));
      }
    });
    setLastSession(lastData);
  }

  async function saveSet(exerciseId: string, exerciseName: string, setIndex: number) {
    if (!sessionId) return;
    const set = sets[exerciseId][setIndex];
    if (!set.reps || !set.weight) return;

    let { data: logData } = await supabase
      .from('exercise_logs')
      .select('id')
      .eq('workout_session_id', sessionId)
      .eq('exercise_name', exerciseName)
      .single();

    if (!logData) {
      const ex = exercises.find(e => e.id === exerciseId);
      const { data: newLog } = await supabase
        .from('exercise_logs')
        .insert([{
          workout_session_id: sessionId,
          exercise_name: exerciseName,
          target_sets: ex?.target_sets,
          target_rep_min: ex?.rep_min,
          target_rep_max: ex?.rep_max
        }])
        .select().single();
      logData = newLog;
    }

    if (!logData) return;
    await supabase.from('exercise_sets').insert([{
      exercise_log_id: logData.id,
      set_number: setIndex + 1,
      reps: parseInt(set.reps),
      weight: parseFloat(set.weight),
      completed: true
    }]);
    setMessage('Set saved!');
    setTimeout(() => setMessage(''), 2000);
  }

  function updateSet(exerciseId: string, setIndex: number, field: 'reps' | 'weight', value: string) {
    setSets(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s, i) => i === setIndex ? { ...s, [field]: value } : s)
    }));
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Log Workout</h1>

      {!sessionId ? (
        <div style={{ background: '#111', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Select Today's Day</h2>
          <select
            value={selectedDayId}
            onChange={e => setSelectedDayId(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px', marginBottom: '0.75rem' }}
          >
            <option value=''>Choose your workout day...</option>
            {days.map(day => (
              <option key={day.id} value={day.id}>{day.day_name}</option>
            ))}
          </select>
          <button
            onClick={startSession}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#fff', color: '#000', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', border: 'none' }}
          >
            Start Session
          </button>
        </div>
      ) : (
        <div>
          {exercises.map(ex => (
            <div key={ex.id} style={{ background: '#111', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{ex.exercise_name}</h2>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '1rem' }}>
                Target: {ex.target_sets} sets × {ex.rep_min}-{ex.rep_max} reps
              </p>

              {lastSession[ex.id] && (
                <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                  <p style={{ color: '#888', fontSize: '12px', marginBottom: '0.5rem' }}>LAST SESSION</p>
                  {lastSession[ex.id].map(s => (
                    <p key={s.setNumber} style={{ color: '#555', fontSize: '13px' }}>
                      Set {s.setNumber}: {s.weight} lbs × {s.reps} reps
                    </p>
                  ))}
                </div>
              )}

              {sets[ex.id]?.map((set, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#666', fontSize: '14px' }}>S{set.setNumber}</span>
                  <input
                    type="number"
                    placeholder="lbs"
                    value={set.weight}
                    onChange={e => updateSet(ex.id, i, 'weight', e.target.value)}
                    style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                  />
                  <input
                    type="number"
                    placeholder="reps"
                    value={set.reps}
                    onChange={e => updateSet(ex.id, i, 'reps', e.target.value)}
                    style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                  />
                  <button
                    onClick={() => saveSet(ex.id, ex.exercise_name, i)}
                    style={{ padding: '0.75rem', borderRadius: '8px', background: '#4ade80', color: '#000', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', border: 'none' }}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {message && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#4ade80', color: '#000', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold' }}>
          {message}
        </div>
      )}
    </main>
  );
}