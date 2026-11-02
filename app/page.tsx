'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from './lib/supabase';
import { nextDayId } from './lib/rotation';

type Recent = { id: string; dayName: string; completedAt: string; sets: number };
type Home = {
  planCount: number;
  planName: string;
  active: { dayName: string } | null;
  next: { dayName: string; exercises: string[] } | null;
  emptyPlan: boolean;
  weekCount: number;
  total: number;
  recent: Recent[];
};

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
function lsGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }

const card = 'rounded-2xl bg-[#111] p-5';
const primary = 'flex h-14 w-full items-center justify-center rounded-xl bg-green-400 text-lg font-bold text-black';

export default function HomePage() {
  const [data, setData] = useState<Home | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => setEmail(s.session?.user.email ?? ''));
    (async () => {
      try {
        const { data: plans } = await supabase.from('workout_plans').select('id, name').order('created_at');
        const planList = (plans ?? []) as { id: string; name: string }[];
        const h: Home = { planCount: planList.length, planName: '', active: null, next: null, emptyPlan: false, weekCount: 0, total: 0, recent: [] };

        // An unfinished workout always comes first.
        const { data: act } = await supabase
          .from('workout_sessions').select('id, workout_days(day_name, plan_id)')
          .is('completed_at', null).order('started_at', { ascending: false }).limit(1);
        const a = act?.[0] as unknown as { workout_days: { day_name: string; plan_id: string } | { day_name: string; plan_id: string }[] | null } | undefined;
        if (a) h.active = { dayName: one(a.workout_days)?.day_name ?? 'Workout' };

        if (planList.length) {
          const stored = lsGet('fl-plan');
          const plan = planList.find(p => p.id === stored) ?? planList[planList.length - 1];
          h.planName = plan.name;
          const { data: days } = await supabase
            .from('workout_days').select('id, day_name, sort_order').eq('plan_id', plan.id).order('sort_order');
          const dayList = (days ?? []) as { id: string; day_name: string }[];
          if (dayList.length) {
            const ids = dayList.map(d => d.id);
            const [{ data: last }, { data: exs }] = await Promise.all([
              supabase.from('workout_sessions').select('workout_day_id, exercise_logs!inner(exercise_sets!inner(id))').in('workout_day_id', ids)
                .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1),
              supabase.from('plan_exercises').select('workout_day_id, exercise_name, sort_order').in('workout_day_id', ids).order('sort_order'),
            ]);
            const byDay = new Map<string, string[]>();
            for (const r of (exs ?? []) as { workout_day_id: string; exercise_name: string }[]) {
              byDay.set(r.workout_day_id, [...(byDay.get(r.workout_day_id) ?? []), r.exercise_name]);
            }
            const lastId = (last?.[0] as { workout_day_id: string } | undefined)?.workout_day_id ?? null;
            const nextId = nextDayId(dayList, lastId, id => byDay.has(id));
            const next = dayList.find(d => d.id === nextId);
            if (next && byDay.has(next.id)) h.next = { dayName: next.day_name, exercises: byDay.get(next.id) ?? [] };
            else h.emptyPlan = true;
          } else h.emptyPlan = true;
        }

        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const [{ count: total }, { count: week }, { data: rec }] = await Promise.all([
          supabase.from('workout_sessions').select('id, exercise_logs!inner(exercise_sets!inner(id))', { count: 'exact', head: true }).not('completed_at', 'is', null),
          supabase.from('workout_sessions').select('id, exercise_logs!inner(exercise_sets!inner(id))', { count: 'exact', head: true }).not('completed_at', 'is', null).gte('completed_at', weekAgo),
          supabase.from('workout_sessions').select('id, completed_at, workout_days(day_name), exercise_logs!inner(exercise_sets!inner(id))')
            .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(3),
        ]);
        h.total = total ?? 0; h.weekCount = week ?? 0;
        h.recent = ((rec ?? []) as unknown as {
          id: string; completed_at: string; workout_days: { day_name: string } | { day_name: string }[] | null;
          exercise_logs: { exercise_sets: { id: string }[] | null }[] | null;
        }[]).map(r => ({
          id: r.id, dayName: one(r.workout_days)?.day_name ?? 'Workout', completedAt: r.completed_at,
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
    <main className="mx-auto max-w-xl px-4 pb-8 pt-6 text-white">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Forgeload</h1>
      <p className="mb-5 text-sm text-[#777]">Plan. Log. Overload.</p>

      {error && <p role="alert" className="mb-4 rounded-xl bg-[#2a1111] p-3 text-sm text-red-300">{error}</p>}
      {!data && !error && <p className="text-[#777]">Loading...</p>}

      {data && (
        <div className="space-y-4">
          {data.active ? (
            <section className={card}>
              <div className="text-xs uppercase tracking-wide text-[#777]">In progress</div>
              <h2 className="mb-3 mt-1 text-2xl font-bold">{data.active.dayName}</h2>
              <Link href="/log" className={primary}>Continue workout</Link>
            </section>
          ) : data.planCount === 0 ? (
            <section className={card}>
              <h2 className="mb-1 text-2xl font-bold">Start with a plan</h2>
              <p className="mb-4 text-[#aaa]">Answer two quick questions and get a plan that fits your week.</p>
              <Link href="/start" className={primary}>Set up my plan</Link>
              <Link href="/plan" className="mt-3 block text-center text-sm text-[#888] underline-offset-2 hover:underline">Or build it yourself</Link>
            </section>
          ) : data.emptyPlan ? (
            <section className={card}>
              <h2 className="mb-1 text-2xl font-bold">{data.planName}</h2>
              <p className="mb-4 text-[#aaa]">Your plan has no exercises yet. Add some to get your next workout.</p>
              <Link href="/plan" className={primary}>Add exercises</Link>
            </section>
          ) : data.next ? (
            <section className={card}>
              <div className="text-xs uppercase tracking-wide text-[#777]">Up next · {data.planName}</div>
              <h2 className="mb-2 mt-1 text-2xl font-bold">{data.next.dayName}</h2>
              <p className="mb-4 text-sm text-[#aaa]">
                {data.next.exercises.slice(0, 4).join(', ')}{data.next.exercises.length > 4 ? ` + ${data.next.exercises.length - 4} more` : ''}
              </p>
              <Link href="/log" className={primary}>Start workout</Link>
              <p className="mt-3 text-center text-xs text-[#666]">You can pick a different workout on the next screen.</p>
            </section>
          ) : null}

          <section className="grid grid-cols-2 gap-3">
            <div className={card}>
              <div className="text-3xl font-bold tabular-nums">{data.weekCount}</div>
              <div className="text-sm text-[#777]">workouts, last 7 days</div>
            </div>
            <div className={card}>
              <div className="text-3xl font-bold tabular-nums">{data.total}</div>
              <div className="text-sm text-[#777]">workouts total</div>
            </div>
          </section>

          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent workouts</h2>
              {data.recent.length > 0 && <Link href="/history" className="text-sm text-green-400">See all</Link>}
            </div>
            {data.recent.length === 0 ? (
              <p className="text-sm text-[#777]">Nothing logged yet. Your finished workouts will show up here.</p>
            ) : (
              <ul className="space-y-2">
                {data.recent.map(r => (
                  <li key={r.id} className="flex items-center justify-between border-b border-[#222] pb-2 last:border-0 last:pb-0">
                    <span className="font-semibold">{r.dayName}</span>
                    <span className="text-sm text-[#777]">{when(r.completedAt)} · {r.sets} sets</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/library" className="block text-center text-sm text-[#888] underline-offset-2 hover:underline">Browse the exercise library</Link>

          <section className={`${card} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-[#777]">Signed in as</div>
              <div className="truncate text-sm">{email || 'your account'}</div>
            </div>
            <Link href="/settings" className="flex h-11 shrink-0 items-center rounded-xl bg-[#222] px-4 text-sm font-semibold">Settings</Link>
          </section>
        </div>
      )}
    </main>
  );
}
