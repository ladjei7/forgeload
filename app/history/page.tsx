'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { ui } from '../components/ui';
import { getUnit, show, label, type Unit } from '../lib/units';
import { parseLocalDate } from '../lib/dates';

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
  day_name: string | null;
  workout_days: { day_name: string } | null;
  exercise_logs: ExerciseLog[];
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit] = useState<Unit>(() => getUnit());

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select(`
          id,
          session_date,
          day_name,
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
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20);
      if (!alive) return;
      if (data) setSessions(data as unknown as Session[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  function totalVolume(sets: SetData[]) {
    return sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
  }

  function getTrend(current: number, previous: number | null) {
    if (previous === null) return null;
    if (current > previous * 1.01) return '↑';
    if (current < previous * 0.99) return '↓';
    return '→';
  }

  // Compare with the most recent earlier session that included the same exercise (not just the session before).
  function previousVolume(sessionIndex: number, name: string) {
    for (const older of sessions.slice(sessionIndex + 1)) {
      const l = older.exercise_logs.find(x => x.exercise_name === name);
      if (l && l.exercise_sets.length) return totalVolume(l.exercise_sets);
    }
    return null;
  }
  const TREND = {
    '↑': { cls: 'text-fl-ok', label: 'More total weight than last time' },
    '↓': { cls: 'text-fl-tx2', label: 'Less total weight than last time' },
    '→': { cls: 'text-fl-tx2', label: 'About the same as last time' },
  } as const;

  return (
    <main className={ui.main}>
      <Link href="/progress" className="-ml-1 mb-1 inline-flex h-10 items-center gap-1 px-1 text-sm font-semibold text-fl-tx2"><span aria-hidden="true">←</span> Progress</Link>
      <h1 className={`${ui.h1} mb-5`}>All workouts</h1>

      {loading && <p className="text-fl-tx2">Loading...</p>}

      {!loading && sessions.length === 0 && (
        <section className={`${ui.card} text-center`}>
          <p className="mb-4 text-fl-tx2">No workouts yet. Finished workouts show up here with every set you logged.</p>
          <Link href="/log" className={ui.primary}>Start a workout</Link>
        </section>
      )}

      <div className="space-y-4">
        {sessions.map((session, sessionIndex) => {
          const setCount = session.exercise_logs.reduce((n, l) => n + l.exercise_sets.length, 0);
          return (
            <section key={session.id} className={ui.card}>
              <h2 className="text-xl font-bold">{session.day_name ?? session.workout_days?.day_name ?? 'Workout'}</h2>
              <p className="text-sm text-fl-tx2">
                {parseLocalDate(session.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {setCount > 0 && ` · ${setCount} ${setCount === 1 ? 'set' : 'sets'}`}
              </p>

              <ul className="mt-3 divide-y divide-fl-line border-t border-fl-line">
                {session.exercise_logs.map(log => {
                  const volume = totalVolume(log.exercise_sets);
                  const trend = getTrend(volume, previousVolume(sessionIndex, log.exercise_name));
                  const sorted = [...log.exercise_sets].sort((a, b) => a.set_number - b.set_number);
                  return (
                    <li key={log.id} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="min-w-0 font-semibold">{log.exercise_name}</h3>
                        <span className="flex shrink-0 items-baseline gap-1.5 text-xs tabular-nums text-fl-tx2">
                          {trend && <span className={`text-base font-bold ${TREND[trend].cls}`} title={TREND[trend].label}>
                            <span aria-hidden="true">{trend}</span><span className="sr-only">{TREND[trend].label}</span></span>}
                          {volume > 0 && `${Math.round(show(volume, unit)).toLocaleString()} ${label(unit)} total`}
                        </span>
                      </div>
                      {sorted.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${log.exercise_name} sets`}>
                          {sorted.map(set => (
                            <li key={set.set_number} className="rounded-lg bg-fl-s2 px-2.5 py-1 text-sm tabular-nums">
                              <span className="sr-only">Set {set.set_number}: </span>
                              {set.weight > 0 ? <>{show(set.weight, unit)} {label(unit)} × {set.reps}</> : <>{set.reps} reps</>}
                            </li>
                          ))}
                        </ul>
                      ) : <p className="mt-1 text-sm text-fl-tx2">No sets logged</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
