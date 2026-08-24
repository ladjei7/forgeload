'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type SetData = {
  set_number: number;
  reps: number;
  weight: number;
};

type ExerciseLog = {
  id: string;
  exercise_name: string;
  target_sets: number;
  target_rep_min: number;
  target_rep_max: number;
  exercise_sets: SetData[];
};

type Session = {
  id: string;
  session_date: string;
  workout_days: { day_name: string } | null;
  exercise_logs: ExerciseLog[];
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from('workout_sessions')
      .select(`
        id,
        session_date,
        workout_days ( day_name ),
        exercise_logs (
          id,
          exercise_name,
          target_sets,
          target_rep_min,
          target_rep_max,
          exercise_sets (
            set_number,
            reps,
            weight
          )
        )
      `)
      .order('session_date', { ascending: false })
      .limit(20);

    if (data) setSessions(data as any);
    setLoading(false);
  }

  function totalVolume(sets: SetData[]) {
    return sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
  }

  function getTrend(current: number, previous: number | null) {
    if (previous === null) return null;
    if (current > previous * 1.01) return '↑';
    if (current < previous * 0.99) return '↓';
    return '→';
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>History</h1>

      {loading && <p style={{ color: '#666' }}>Loading...</p>}

      {!loading && sessions.length === 0 && (
        <div style={{ background: '#111', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#666' }}>No sessions yet. Log your first workout.</p>
        </div>
      )}

      {sessions.map((session, sessionIndex) => (
        <div key={session.id} style={{ background: '#111', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                {session.workout_days?.day_name ?? 'Workout'}
              </h2>
              <p style={{ color: '#666', fontSize: '13px' }}>
                {new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {session.exercise_logs.map(log => {
            const volume = totalVolume(log.exercise_sets);
            const prevSession = sessions[sessionIndex + 1];
            const prevLog = prevSession?.exercise_logs.find(l => l.exercise_name === log.exercise_name);
            const prevVolume = prevLog ? totalVolume(prevLog.exercise_sets) : null;
            const trend = getTrend(volume, prevVolume);

            return (
              <div key={log.id} style={{ borderTop: '1px solid #222', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{log.exercise_name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {trend && (
                      <span style={{
                        fontSize: '18px',
                        color: trend === '↑' ? '#4ade80' : trend === '↓' ? '#f87171' : '#888'
                      }}>
                        {trend}
                      </span>
                    )}
                    <span style={{ color: '#555', fontSize: '12px' }}>
                      {volume > 0 ? `${volume.toLocaleString()} lbs total` : ''}
                    </span>
                  </div>
                </div>

                {log.exercise_sets
                  .sort((a, b) => a.set_number - b.set_number)
                  .map(set => (
                    <p key={set.set_number} style={{ color: '#888', fontSize: '13px', marginBottom: '2px' }}>
                      Set {set.set_number}: {set.weight} lbs × {set.reps} reps
                    </p>
                  ))}

                {log.exercise_sets.length === 0 && (
                  <p style={{ color: '#444', fontSize: '13px' }}>No sets logged</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </main>
  );
}