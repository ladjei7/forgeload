'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { ui, Icon } from '../components/ui';
import LiftChart from '../components/LiftChart';
import { liftProgress, summary, recentRecords, improvement, headline, setLabel as rawLabel, type PSession } from '../lib/progressStats';
import { getUnit, type Unit } from '../lib/units';

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ProgressPage() {
  const [sessions, setSessions] = useState<PSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [unit] = useState<Unit>(() => getUnit());
  const setLabel = (p: { weight: number; reps: number }) => rawLabel(p, unit);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, completed_at, is_deload, exercise_logs ( exercise_name, exercise_id, exercise_sets ( reps, weight, set_type, skipped ) )')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true })
        .limit(500);
      if (!alive) return;
      if (error) setFailed(true); else setSessions((data ?? []) as unknown as PSession[]);
    })();
    return () => { alive = false; };
  }, []);

  const lifts = useMemo(() => liftProgress(sessions ?? []), [sessions]);
  const sum = useMemo(() => summary(sessions ?? [], lifts), [sessions, lifts]);
  const records = useMemo(() => recentRecords(lifts).slice(0, 5), [lifts]);
  const shown = showAll ? lifts : lifts.slice(0, 8);

  return (
    <main className={ui.main}>
      <h1 className={`${ui.h1} mb-5`}>Progress</h1>

      {failed && <p role="alert" className="rounded-xl bg-fl-s2 p-3 text-sm text-fl-bad">⚠ Couldn&apos;t load your progress. Check your connection and try again.</p>}
      {!failed && sessions === null && <p className="text-fl-tx2">Loading...</p>}

      {sessions && sessions.length === 0 && (
        <section className={`${ui.card} text-center`}>
          <h2 className={ui.h2}>Your progress shows up here</h2>
          <p className={`${ui.sub} mb-4 mt-1`}>Finish a workout and you&apos;ll see your best sets, new records and how each lift is trending.</p>
          <Link href="/log" className={ui.primary}>Start a workout</Link>
        </section>
      )}

      {sessions && sessions.length > 0 && (
        <div className="space-y-4">
          {/* One plain sentence: how it's going */}
          <section className="flex items-start gap-3 rounded-2xl border border-fl-acc/50 bg-fl-tint p-4">
            <Icon name="star" size={22} filled className="mt-0.5 shrink-0 text-fl-acc" />
            <p className="font-semibold leading-snug">{headline(lifts, sum)}</p>
          </section>

          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: sum.thisMonth, label: 'workouts this month' },
              { n: sum.weekStreak, label: sum.weekStreak === 1 ? 'week in a row' : 'weeks in a row' },
              { n: sum.recordsLast30, label: sum.recordsLast30 === 1 ? 'new record, 30 days' : 'new records, 30 days' },
            ].map(t => (
              <div key={t.label} className="rounded-2xl border border-fl-line bg-fl-s1 p-3">
                <div className="text-2xl font-bold tabular-nums">{t.n}</div>
                <div className="text-xs leading-snug text-fl-tx2">{t.label}</div>
              </div>
            ))}
          </div>

          {/* Recent records */}
          <section className={ui.card}>
            <h2 className={ui.h2}>Recent records</h2>
            {records.length === 0 ? (
              <p className={`${ui.sub} mt-1`}>No new records in the last 30 days yet. Beat your best set on any lift and it shows up here.</p>
            ) : (
              <ul className="mt-2 divide-y divide-fl-line">
                {records.map(r => (
                  <li key={r.lift.key + r.point.sessionId} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-semibold">{r.lift.name}</span>
                      <span className="block text-xs text-fl-tx2">Was {setLabel(r.previous)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{setLabel(r.point)}</span>
                      <span className="block text-xs text-fl-tx2">{fmt(r.point.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Every lift */}
          <section className={ui.card}>
            <h2 className={ui.h2}>Your lifts</h2>
            <p className={`${ui.sub} mb-1`}>Your first time next to your best set. Tap a lift to see every workout; ▲ marks a step up in weight.</p>
            <ul className="divide-y divide-fl-line">
              {shown.map(l => {
                const isOpen = open === l.key;
                const up = improvement(l, unit);
                const many = l.points.length > 1;
                return (
                  <li key={l.key} className="py-1">
                    <button onClick={() => setOpen(isOpen ? null : l.key)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{l.name}</span>
                        <span className="block text-xs text-fl-tx2">
                          {many ? <>First {setLabel(l.first)} · Best {setLabel(l.best)}</> : <>Starting point: {setLabel(l.best)}</>}
                        </span>
                      </span>
                      {up && (
                        <span className="shrink-0 rounded-full bg-fl-ok/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-fl-ok">{up}</span>
                      )}
                      <Icon name={isOpen ? 'up' : 'down'} size={18} className="shrink-0 text-fl-tx2" />
                    </button>
                    {isOpen && (
                      <div className="pb-3">
                        <LiftChart points={l.points} kind={l.kind} name={l.name} unit={unit} />
                        <table className="mt-3 w-full text-sm tabular-nums">
                          <caption className="sr-only">{l.name}: best set each workout</caption>
                          <thead><tr className="text-left text-xs text-fl-tx2"><th className="py-1 font-medium">Date</th><th className="py-1 text-right font-medium">Best set</th></tr></thead>
                          <tbody>
                            {[...l.points].reverse().slice(0, 10).map(p => (
                              <tr key={p.sessionId} className="border-t border-fl-line">
                                <td className="py-1.5">{fmt(p.date)}</td>
                                <td className="py-1.5 text-right">{p.deload && <span className="mr-1.5 text-xs font-semibold text-fl-tx2">Deload</span>}{p.weightUp && <span className="mr-1.5 text-xs font-semibold text-fl-ok">▲ Moved up</span>}{p.record && <span className="mr-1.5 text-xs font-semibold text-fl-ok">Record</span>}{setLabel(p)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {lifts.length > 8 && !showAll && <button onClick={() => setShowAll(true)} className={`${ui.secondary} mt-3`}>Show all {lifts.length} lifts</button>}
          </section>

          <Link href="/history" className="flex h-12 items-center justify-center gap-1.5 font-semibold text-fl-acc">
            All workouts <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      )}
    </main>
  );
}
