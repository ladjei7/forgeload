'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from './lib/supabase';
import { nextDayId } from './lib/rotation';
import { pickCurrent } from './lib/pickCurrent';
import SwapSuggestionCard from './components/SwapSuggestionCard';
import { summarize, weekDots, todayIndex, estimateMinutes, rotationPosition, type ExSummary, type HistEntry, type PlanExLite } from './lib/homeSummary';

type Recent = { id: string; dayName: string; completedAt: string; sets: number };
type Home = {
  planCount: number;
  planName: string;
  active: { dayName: string } | null;
  next: { dayName: string; exercises: ExSummary[]; pos: { n: number; of: number } | null; minutes: number } | null;
  dots: boolean[];
  emptyPlan: boolean;
  weekCount: number;
  total: number;
  recent: Recent[];
};

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
function lsGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }

const card = 'rounded-2xl bg-fl-s1 border border-fl-line p-5';
const primary = 'flex h-14 w-full items-center justify-center rounded-xl bg-fl-acc text-lg font-bold text-fl-on-acc';

export default function HomePage() {
  const [data, setData] = useState<Home | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => setEmail(s.session?.user.email ?? ''));
    (async () => {
      try {
        const { data: plans } = await supabase.from('workout_plans').select('id, name, is_active').order('created_at');
        const planList = (plans ?? []) as { id: string; name: string; is_active: boolean | null }[];
        const h: Home = { planCount: planList.length, planName: '', active: null, next: null, emptyPlan: false, weekCount: 0, total: 0, recent: [], dots: Array(7).fill(false) };

        // An unfinished workout always comes first.
        const { data: act } = await supabase
          .from('workout_sessions').select('id, day_name, workout_days(day_name, plan_id)')
          .is('completed_at', null).order('started_at', { ascending: false }).limit(1);
        const a = act?.[0] as unknown as { day_name: string | null; workout_days: { day_name: string; plan_id: string } | { day_name: string; plan_id: string }[] | null } | undefined;
        if (a) h.active = { dayName: a.day_name ?? one(a.workout_days)?.day_name ?? 'Workout' };

        if (planList.length) {
          const stored = lsGet('fl-plan');
          const plan = pickCurrent(planList, stored)!;
          h.planName = plan.name;
          const { data: days } = await supabase
            .from('workout_days').select('id, day_name, sort_order').eq('plan_id', plan.id).order('sort_order');
          const dayList = (days ?? []) as { id: string; day_name: string }[];
          if (dayList.length) {
            const ids = dayList.map(d => d.id);
            const [{ data: last }, { data: exs }] = await Promise.all([
              supabase.from('workout_sessions').select('workout_day_id, exercise_logs!inner(exercise_sets!inner(id))').in('workout_day_id', ids)
                .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1),
              supabase.from('plan_exercises').select('workout_day_id, exercise_name, exercise_id, target_sets, rep_min, rep_max, sort_order').in('workout_day_id', ids).order('sort_order'),
            ]);
            const byDay = new Map<string, PlanExLite[]>();
            for (const r of (exs ?? []) as { workout_day_id: string; exercise_name: string; exercise_id: string | null; target_sets: number; rep_min: number; rep_max: number }[]) {
              byDay.set(r.workout_day_id, [...(byDay.get(r.workout_day_id) ?? []), { name: r.exercise_name, exerciseId: r.exercise_id, sets: r.target_sets, repMin: r.rep_min, repMax: r.rep_max }]);
            }
            const lastId = (last?.[0] as { workout_day_id: string } | undefined)?.workout_day_id ?? null;
            const nextId = nextDayId(dayList, lastId, id => byDay.has(id));
            const next = dayList.find(d => d.id === nextId);
            if (next && byDay.has(next.id)) {
              const planEx = byDay.get(next.id) ?? [];
              // Last performance for these exercises, from COMPLETED sessions only (same source the workout screen uses).
              const quoted = planEx.map(e => `"${e.name.replace(/"/g, '\\"')}"`).join(',');
              const exIds = planEx.map(e => e.exerciseId).filter(Boolean).join(',');
              const { data: hist } = await supabase.from('exercise_logs')
                .select('exercise_name, exercise_id, workout_sessions!inner(completed_at), exercise_sets(set_number, reps, weight)')
                .or(exIds ? `exercise_name.in.(${quoted}),exercise_id.in.(${exIds})` : `exercise_name.in.(${quoted})`)
                .not('workout_sessions.completed_at', 'is', null).limit(500);
              const entries: HistEntry[] = ((hist ?? []) as unknown as { exercise_name: string; exercise_id: string | null; workout_sessions: { completed_at: string } | { completed_at: string }[] | null; exercise_sets: HistEntry['sets'] | null }[])
                .map(r => ({ name: r.exercise_name, exerciseId: r.exercise_id, at: one(r.workout_sessions)?.completed_at ?? '', sets: r.exercise_sets ?? [] }));
              h.next = { dayName: next.day_name, exercises: summarize(planEx, entries), pos: rotationPosition(dayList.map(d => d.id), next.id), minutes: estimateMinutes(planEx) };
            }
            else h.emptyPlan = true;
          } else h.emptyPlan = true;
        }

        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { data: wk } = await supabase.from('workout_sessions').select('completed_at, exercise_logs!inner(exercise_sets!inner(id))')
          .not('completed_at', 'is', null).gte('completed_at', new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString());
        h.dots = weekDots(((wk ?? []) as { completed_at: string }[]).map(r => r.completed_at), new Date());
        const [{ count: total }, { count: week }, { data: rec }] = await Promise.all([
          supabase.from('workout_sessions').select('id, exercise_logs!inner(exercise_sets!inner(id))', { count: 'exact', head: true }).not('completed_at', 'is', null),
          supabase.from('workout_sessions').select('id, exercise_logs!inner(exercise_sets!inner(id))', { count: 'exact', head: true }).not('completed_at', 'is', null).gte('completed_at', weekAgo),
          supabase.from('workout_sessions').select('id, completed_at, day_name, workout_days(day_name), exercise_logs!inner(exercise_sets!inner(id))')
            .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(3),
        ]);
        h.total = total ?? 0; h.weekCount = week ?? 0;
        h.recent = ((rec ?? []) as unknown as {
          id: string; completed_at: string; day_name: string | null; workout_days: { day_name: string } | { day_name: string }[] | null;
          exercise_logs: { exercise_sets: { id: string }[] | null }[] | null;
        }[]).map(r => ({
          id: r.id, dayName: r.day_name ?? one(r.workout_days)?.day_name ?? 'Workout', completedAt: r.completed_at,
          sets: (r.exercise_logs ?? []).reduce((n, l) => n + (l.exercise_sets?.length ?? 0), 0),
        }));
        setData(h);
      } catch {
        setError('Could not load your home screen. Check your connection and refresh.');
      }
    })();
  }, []);

  const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <main className="mx-auto max-w-xl px-4 pb-8 pt-6 text-fl-tx">
      <div className="mb-5 flex items-center gap-3">
        <Image src="/brand/forgeload-symbol-1024.png" alt="" width={44} height={32} className="h-8 w-auto" priority />
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-tight">Forgeload</h1>
          <p className="mt-1 text-xs text-fl-tx2">Plan. Log. Overload.</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-fl-s2 p-3 text-sm text-fl-bad">{error}</p>}
      {!data && !error && <p className="text-fl-tx2">Loading...</p>}

      {data && (
        <div className="space-y-4">
          {data.active ? (
            <section className={card}>
              <div className="text-xs uppercase tracking-wide text-fl-tx2">In progress</div>
              <h2 className="mb-3 mt-1 text-2xl font-bold">{data.active.dayName}</h2>
              <Link href="/log" className={primary}>Resume workout</Link>
            </section>
          ) : data.planCount === 0 ? (
            <section className={card}>
              <h2 className="mb-1 text-2xl font-bold">Start with a plan</h2>
              <p className="mb-4 text-fl-tx2">Answer two quick questions and get a plan that fits your week.</p>
              <Link href="/start" className={primary}>Set up my plan</Link>
              <Link href="/plan" className="mt-3 block text-center text-sm text-fl-tx2 underline-offset-2 hover:underline">Or build it yourself</Link>
            </section>
          ) : data.emptyPlan ? (
            <section className={card}>
              <h2 className="mb-1 text-2xl font-bold">{data.planName}</h2>
              <p className="mb-4 text-fl-tx2">Your plan has no exercises yet. Add some to get your next workout.</p>
              <Link href="/plan" className={primary}>Add exercises</Link>
            </section>
          ) : data.next ? (
            <section className={card} aria-label="Next workout">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-fl-tx2">Up next · {data.planName}</div>
                {data.total === 0 && <span className="rounded-full bg-fl-s2 px-2.5 py-1 text-xs text-fl-tx2">First workout</span>}
              </div>
              <h2 className="mt-1 text-2xl font-bold">{data.next.dayName}</h2>
              <p className="mb-3 text-sm text-fl-tx2">
                {data.next.pos ? `Workout ${data.next.pos.n} of ${data.next.pos.of} in your rotation` : ''}{data.next.pos && data.next.minutes ? ' · ' : ''}{data.next.minutes ? `about ${data.next.minutes} min` : ''}
              </p>
              <ul className="mb-4 divide-y divide-fl-line">
                {data.next.exercises.slice(0, 6).map(e => (
                  <li key={e.name} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{e.name}</div>
                      <div className="text-xs text-fl-tx2">{e.sets} sets · {e.repMin}-{e.repMax} reps</div>
                    </div>
                    <div className="shrink-0 text-right text-sm tabular-nums">
                      {e.last ? (
                        <>
                          <div className="text-fl-tx2">Last {e.last[0].weight}×{e.last[0].reps}</div>
                          <div className="font-semibold">Target {e.target.weight !== null ? `${e.target.weight}` : 'add load'}×{e.target.reps}</div>
                        </>
                      ) : (
                        <div className="text-fl-tx2">Find your weight</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {data.next.exercises.length > 6 && <p className="-mt-2 mb-4 text-xs text-fl-tx2">+ {data.next.exercises.length - 6} more</p>}
              {data.total === 0 && (
                <p className="mb-4 rounded-xl bg-fl-s2 p-3 text-sm leading-relaxed text-fl-tx2">
                  First time through: pick a weight you can lift for the rep range with a rep or two left in the tank. Forgeload remembers it, then shows what you did last time and a target next time.
                </p>
              )}
              <Link href="/log" className={primary}>Start workout</Link>
              <p className="mt-3 text-center text-xs text-fl-tx2">You can pick a different workout on the next screen.</p>
            </section>
          ) : null}

          {!data.active && data.planCount > 0 && <SwapSuggestionCard />}

          {data.total > 0 && (
            <section className={card} aria-label="This week">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-bold">This week</h2>
                <span className="text-sm text-fl-tx2">{data.dots.filter(Boolean).length} {data.dots.filter(Boolean).length === 1 ? 'workout' : 'workouts'}</span>
              </div>
              <div className="flex justify-between">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5" aria-label={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}: ${data.dots[i] ? 'workout done' : i === todayIndex(new Date()) ? 'today' : 'no workout'}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${data.dots[i] ? 'bg-fl-ok text-fl-on-ok' : i === todayIndex(new Date()) ? 'border-2 border-fl-field text-fl-tx' : 'border border-fl-line text-fl-tx2'}`}>{data.dots[i] ? '✓' : ''}</span>
                    <span className="text-xs text-fl-tx2">{l}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-fl-tx2">Your plan follows a rotation, not the calendar: a missed day never skips a workout. {data.total} workouts logged in total.</p>
            </section>
          )}

          {data.recent.length > 0 && (
            <section className={card}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Recent workouts</h2>
                <Link href="/history" className="text-sm text-fl-tx2 underline underline-offset-2">See all</Link>
              </div>
              <ul className="space-y-2">
                {data.recent.map(r => (
                  <li key={r.id} className="flex items-center justify-between border-b border-fl-line pb-2 last:border-0 last:pb-0">
                    <span className="font-semibold">{r.dayName}</span>
                    <span className="text-sm text-fl-tx2">{when(r.completedAt)} · {r.sets} sets</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/library" className="block text-center text-sm text-fl-tx2 underline-offset-2 hover:underline">Browse the exercise library</Link>

          <section className={`${card} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-fl-tx2">Signed in as</div>
              <div className="truncate text-sm">{email || 'your account'}</div>
            </div>
            <Link href="/settings" className="flex h-11 shrink-0 items-center rounded-xl bg-fl-s2 px-4 text-sm font-semibold">Settings</Link>
          </section>
        </div>
      )}
    </main>
  );
}
