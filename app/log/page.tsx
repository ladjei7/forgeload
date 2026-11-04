'use client';
import { logEvent } from '../lib/events';
import { SWAP_REASONS, type SwapReason } from '../lib/rules';
import ExercisePicker from '../components/ExercisePicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { suggestTarget, defaultRestSeconds, type PrevSet } from '../lib/progression';
import { nextDayId } from '../lib/rotation';
import { localDateString } from '../lib/dates';

type Plan = { id: string; name: string };
type Day = { id: string; day_name: string; sort_order: number };
type PlanEx = { id: string; exercise_name: string; exercise_id: string | null; target_sets: number; rep_min: number; rep_max: number };
type SetRow = { weight: string; reps: string; done: boolean; setId?: string; state?: 'saving' | 'failed' };
type Rest = { end: number; total: number; paused?: number };
type Session = { id: string; workout_day_id: string; started_at: string };
type Prev = { sets: PrevSet[] };
type Summary = {
  dayName: string; minutes: number; exercises: number; sets: number; volume: number;
  prs: { name: string; weight: number; before: number }[];
};

type HistRow = {
  exercise_name: string;
  exercise_id: string | null;
  workout_sessions: { completed_at: string } | { completed_at: string }[] | null;
  exercise_sets: { set_number: number; reps: number; weight: number }[] | null;
};

const LS = { plan: 'fl-plan', rest: 'fl-rest', draft: (id: string) => `fl-draft-${id}`, swaps: (id: string) => `fl-swaps-${id}` };
// A swap-for-today is remembered per session so a reload mid-workout keeps it. The plan itself is not touched unless the user asks.
type Swap = { name: string; id: string | null; fromName: string; fromId: string | null };
function readSwaps(sessionId: string | undefined): Record<string, Swap> { if (!sessionId) return {}; try { return JSON.parse(lsGet(LS.swaps(sessionId)) ?? '{}'); } catch { return {}; } }

function lsGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function readDrafts(sessionId: string): Record<string, unknown> { try { return JSON.parse(lsGet(LS.draft(sessionId)) ?? '{}'); } catch { return {}; } }
function lsSet(key: string, v: string | null) { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* storage unavailable: app still works */ } }

const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const clean = (v: string) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

export default function LogPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState<Day[]>([]);
  const [dayId, setDayId] = useState('');
  const [suggestedDayId, setSuggestedDayId] = useState('');
  const [emptyDays, setEmptyDays] = useState<string[]>([]);
  const [exercises, setExercises] = useState<PlanEx[]>([]);
  const [meta, setMeta] = useState<Record<string, { tracking: string; load: string }>>({});
  const [prev, setPrev] = useState<Record<string, Prev>>({});
  const [bestWeight, setBestWeight] = useState<Record<string, number>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [rest, setRest] = useState<Rest | null>(null);
  const [swapFor, setSwapFor] = useState(''); // plan exercise being swapped
  const [swapName, setSwapName] = useState('');
  const [swapId, setSwapId] = useState('');
  const [swapPlan, setSwapPlan] = useState(false);
  const [swapReason, setSwapReason] = useState<SwapReason | ''>('');
  const [focus, setFocus] = useState(() => lsGet('fl-log-mode') === 'focus');
  const [focusId, setFocusId] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const logIds = useRef<Record<string, Promise<string>>>({});
  const pending = useRef<Set<string>>(new Set());
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // ---------- loading ----------

  const loadDayContext = useCallback(async (day: string, activeSession: Session | null) => {
    const { data: exData } = await supabase
      .from('plan_exercises').select('id, exercise_name, exercise_id, target_sets, rep_min, rep_max')
      .eq('workout_day_id', day).order('sort_order');
    const sw = readSwaps(activeSession?.id);
    const list = ((exData ?? []) as PlanEx[]).map(e => (sw[e.id] ? { ...e, exercise_name: sw[e.id].name, exercise_id: sw[e.id].id } : e));
    setExercises(list);

    // How each exercise is logged (bodyweight, per-hand weights). Missing info = normal weight x reps.
    const metaIds = list.map(e => e.exercise_id).filter(Boolean) as string[];
    if (metaIds.length) {
      const { data: mdata } = await supabase.from('exercises').select('id, tracking_type, load_convention').in('id', metaIds);
      const m: Record<string, { tracking: string; load: string }> = {};
      for (const r of (mdata ?? []) as { id: string; tracking_type: string; load_convention: string }[]) m[r.id] = { tracking: r.tracking_type, load: r.load_convention };
      setMeta(m);
    } else setMeta({});

    // History for these exercises, from COMPLETED sessions only.
    const prevMap: Record<string, Prev> = {};
    const best: Record<string, number> = {};
    if (list.length) {
      // A past log belongs to a plan exercise if it has the same exercise_id (survives renames)
      // or, for older rows without an id, the same name. Different exercises never share history.
      const quoted = list.map(e => `"${e.exercise_name.replace(/"/g, '\\"')}"`).join(',');
      const ids = list.map(e => e.exercise_id).filter(Boolean).join(',');
      const { data: hist } = await supabase
        .from('exercise_logs')
        .select('exercise_name, exercise_id, workout_sessions!inner(completed_at), exercise_sets(set_number, reps, weight)')
        .or(ids ? `exercise_name.in.(${quoted}),exercise_id.in.(${ids})` : `exercise_name.in.(${quoted})`)
        .not('workout_sessions.completed_at', 'is', null)
        .limit(1000);
      const planById = new Map(list.filter(e => e.exercise_id).map(e => [e.exercise_id as string, e.exercise_name]));
      const planByName = new Map(list.map(e => [e.exercise_name.trim().toLowerCase(), e.exercise_name]));
      const byName: Record<string, { at: string; sets: HistRow['exercise_sets'] }[]> = {};
      for (const r of (hist ?? []) as unknown as HistRow[]) {
        const key = (r.exercise_id && planById.get(r.exercise_id)) || planByName.get(r.exercise_name.trim().toLowerCase());
        if (!key) continue;
        const at = one(r.workout_sessions)?.completed_at ?? '';
        (byName[key] ??= []).push({ at, sets: r.exercise_sets });
        for (const s of r.exercise_sets ?? []) if (s.reps > 0) best[key] = Math.max(best[key] ?? 0, s.weight);
      }
      for (const [name, entries] of Object.entries(byName)) {
        entries.sort((a, b) => b.at.localeCompare(a.at));
        const latest = entries.find(e => (e.sets ?? []).some(s => s.reps > 0));
        if (latest) prevMap[name] = { sets: [...(latest.sets ?? [])].sort((a, b) => a.set_number - b.set_number).map(s => ({ reps: s.reps, weight: s.weight })) };
      }
    }
    setPrev(prevMap);
    setBestWeight(best);

    // Rows: empty rows for the plan, filled in from any sets already saved in this session.
    const saved: Record<string, Record<number, { id: string; reps: number; weight: number }>> = {};
    logIds.current = {};
    if (activeSession) {
      const { data: logs } = await supabase
        .from('exercise_logs').select('id, exercise_name, exercise_sets(id, set_number, reps, weight)')
        .eq('workout_session_id', activeSession.id);
      for (const l of (logs ?? []) as unknown as { id: string; exercise_name: string; exercise_sets: { id: string; set_number: number; reps: number; weight: number }[] | null }[]) {
        logIds.current[l.exercise_name] = Promise.resolve(l.id);
        saved[l.exercise_name] = {};
        for (const s of l.exercise_sets ?? []) saved[l.exercise_name][s.set_number] = s;
      }
    }
    let drafts: Record<string, { weight: string; reps: string }[]> = {};
    if (activeSession) { try { drafts = JSON.parse(lsGet(LS.draft(activeSession.id)) ?? '{}'); } catch { drafts = {}; } }
    const next: Record<string, SetRow[]> = {};
    for (const ex of list) {
      const have = saved[ex.exercise_name] ?? {};
      const count = Math.max(ex.target_sets, ...Object.keys(have).map(Number), 0);
      next[ex.id] = Array.from({ length: count }, (_, i) => {
        const s = have[i + 1];
        if (s) return { weight: String(s.weight), reps: String(s.reps), done: true, setId: s.id };
        const d = drafts[ex.id]?.[i];
        return { weight: d?.weight ?? '', reps: d?.reps ?? '', done: false };
      });
    }
    setRows(next);
  }, []);

  const loadPlanDays = useCallback(async (pid: string, preferDay?: string) => {
    const { data: dData } = await supabase
      .from('workout_days').select('id, day_name, sort_order').eq('plan_id', pid).order('sort_order');
    const list = (dData ?? []) as Day[];
    setDays(list);
    let last: string | null = null;
    if (list.length) {
      const { data: done } = await supabase
        .from('workout_sessions').select('workout_day_id, exercise_logs!inner(exercise_sets!inner(id))')
        .in('workout_day_id', list.map(d => d.id)).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(1);
      // Only workouts with at least one logged set count (old empty sessions are ignored).
      last = (done?.[0] as { workout_day_id: string } | undefined)?.workout_day_id ?? null;
    }
    // Days with no exercises can't be started, so rotation skips them.
    let withExercises = new Set<string>();
    if (list.length) {
      const { data: exDays } = await supabase
        .from('plan_exercises').select('workout_day_id').in('workout_day_id', list.map(d => d.id));
      withExercises = new Set((exDays ?? []).map(r => (r as { workout_day_id: string }).workout_day_id));
    }
    setEmptyDays(list.filter(d => !withExercises.has(d.id)).map(d => d.id));
    const suggested = nextDayId(list, last, id => withExercises.has(id)) ?? '';
    setSuggestedDayId(suggested);
    const chosen = preferDay ?? suggested;
    setDayId(chosen);
    if (chosen) await loadDayContext(chosen, null);
    else { setExercises([]); setRows({}); }
  }, [loadDayContext]);

  useEffect(() => {
    (async () => {
      try {
        const { data: pData } = await supabase.from('workout_plans').select('id, name').order('created_at');
        const planList = (pData ?? []) as Plan[];
        setPlans(planList);
        const savedRest = lsGet(LS.rest);
        if (savedRest) { try { const r = JSON.parse(savedRest); if (r.end > Date.now()) setRest(r); } catch { /* ignore */ } }
        if (planList.length === 0) return;

        // Resume an unfinished workout instead of creating a duplicate.
        const { data: active } = await supabase
          .from('workout_sessions').select('id, workout_day_id, started_at, workout_days(plan_id)')
          .is('completed_at', null).order('started_at', { ascending: false }).limit(1);
        const a = active?.[0] as unknown as (Session & { workout_days: { plan_id: string } | { plan_id: string }[] | null }) | undefined;
        if (a) {
          const pid = one(a.workout_days)?.plan_id ?? planList[planList.length - 1].id;
          setPlanId(pid);
          const { data: dData } = await supabase
            .from('workout_days').select('id, day_name, sort_order').eq('plan_id', pid).order('sort_order');
          setDays((dData ?? []) as Day[]);
          const s: Session = { id: a.id, workout_day_id: a.workout_day_id, started_at: a.started_at };
          setSession(s); setDayId(s.workout_day_id);
          await loadDayContext(s.workout_day_id, s);
          return;
        }
        const stored = lsGet(LS.plan);
        const pid = planList.find(p => p.id === stored)?.id ?? planList[planList.length - 1].id;
        setPlanId(pid);
        await loadPlanDays(pid);
      } catch {
        setError('Could not load your workout. Check your connection and refresh.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDayContext, loadPlanDays]);

  // Rest timer tick (elapsed-time based, so it stays correct if the tab sleeps).
  useEffect(() => {
    if (!rest || rest.paused !== undefined) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  // Keep unsaved typing so a refresh doesn't lose it.
  useEffect(() => {
    if (!session) return;
    const drafts: Record<string, { weight: string; reps: string }[]> = {};
    for (const [id, rs] of Object.entries(rows)) drafts[id] = rs.map(r => (r.done ? { weight: '', reps: '' } : { weight: r.weight, reps: r.reps }));
    lsSet(LS.draft(session.id), JSON.stringify(drafts));
  }, [rows, session]);

  // ---------- derived ----------

  const targets = useMemo(() => {
    const t: Record<string, ReturnType<typeof suggestTarget>> = {};
    for (const ex of exercises) t[ex.id] = suggestTarget(prev[ex.exercise_name]?.sets ?? [], ex.rep_min, ex.rep_max);
    return t;
  }, [exercises, prev]);

  const restLeft = rest ? (rest.paused ?? Math.max(0, Math.ceil((rest.end - now) / 1000))) : 0;
  const elapsed = session ? Math.max(0, Math.floor((now - Date.parse(session.started_at)) / 1000)) : 0;
  const clock = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : mmss(sec));
  const doneCount = Object.values(rows).flat().filter(r => r.done).length;
  const dayName = days.find(d => d.id === dayId)?.day_name ?? '';

  // ---------- actions ----------

  function startRest(seconds: number) {
    const r = { end: Date.now() + seconds * 1000, total: seconds };
    setNow(Date.now()); setRest(r); lsSet(LS.rest, JSON.stringify(r));
  }
  function adjustRest(delta: number) {
    if (!rest) return;
    const r = rest.paused !== undefined ? { ...rest, paused: Math.max(0, rest.paused + delta) } : { ...rest, end: Math.max(Date.now(), rest.end + delta * 1000) };
    setRest(r); lsSet(LS.rest, JSON.stringify(r));
  }
  function togglePause() {
    if (!rest) return;
    const r: Rest = rest.paused !== undefined ? { end: Date.now() + rest.paused * 1000, total: rest.total } : { ...rest, paused: restLeft };
    setNow(Date.now()); setRest(r); lsSet(LS.rest, JSON.stringify(r));
  }
  function toggleFocus() { setFocus(f => { lsSet('fl-log-mode', f ? 'standard' : 'focus'); return !f; }); setFocusId(''); }
  function stopRest() { setRest(null); lsSet(LS.rest, null); }

  async function changePlan(pid: string) {
    setPlanId(pid); lsSet(LS.plan, pid); setShowPicker(false);
    await loadPlanDays(pid);
  }
  async function changeDay(id: string) {
    setDayId(id); setShowPicker(false);
    await loadDayContext(id, null);
  }

  async function startWorkout() {
    if (starting || !dayId) return;
    setStarting(true); setError('');
    try {
      // Re-check for an unfinished session (double-tap, second device) before creating another.
      const { data: existing } = await supabase
        .from('workout_sessions').select('id, workout_day_id, started_at')
        .is('completed_at', null).order('started_at', { ascending: false }).limit(1);
      let s = existing?.[0] as Session | undefined;
      if (!s) {
        const { data, error: err } = await supabase
          .from('workout_sessions').insert([{ workout_day_id: dayId, session_date: localDateString() }])
          .select('id, workout_day_id, started_at').single();
        if (err || !data) throw err ?? new Error('no session');
        s = data as Session;
      }
      setSession(s); setDayId(s.workout_day_id);
      await loadDayContext(s.workout_day_id, s);
    } catch {
      setError('Could not start the workout. Check your connection and try again.');
    } finally {
      setStarting(false);
    }
  }

  function ensureLog(ex: PlanEx): Promise<string> {
    const existing = logIds.current[ex.exercise_name];
    if (existing) return existing;
    const p = (async () => {
      const { data, error: err } = await supabase.from('exercise_logs').insert([{
        workout_session_id: session!.id, exercise_name: ex.exercise_name, exercise_id: ex.exercise_id,
        target_sets: ex.target_sets, target_rep_min: ex.rep_min, target_rep_max: ex.rep_max,
      }]).select('id').single();
      if (err || !data) { delete logIds.current[ex.exercise_name]; throw err ?? new Error('no log'); }
      if (ex.exercise_id) supabase.rpc('touch_exercise', { ex: ex.exercise_id }).then(() => {}, () => {}); // recents; failure is harmless
      return (data as { id: string }).id;
    })();
    logIds.current[ex.exercise_name] = p;
    return p;
  }

  async function doSwap(ex: PlanEx) {
    if (!session) return;
    if (!swapId) return setError('Pick an exercise from the list to swap to.');
    if (swapId === ex.exercise_id) return setError('That is the same exercise.');
    setError('');
    const to = { id: swapId, name: swapName.trim() };
    const sw = readSwaps(session.id); const orig = sw[ex.id] ?? { fromName: ex.exercise_name, fromId: ex.exercise_id };
    if (swapPlan) {
      const { error: err } = await supabase.from('plan_exercises').update({ exercise_name: to.name, exercise_id: to.id }).eq('id', ex.id);
      if (err) return setError('Could not change your plan. Check your connection and try again.');
      delete sw[ex.id];
    } else sw[ex.id] = { name: to.name, id: to.id, fromName: orig.fromName, fromId: orig.fromId };
    lsSet(LS.swaps(session.id), JSON.stringify(sw));
    const d = readDrafts(session.id); delete d[ex.id]; lsSet(LS.draft(session.id), JSON.stringify(d)); // typed numbers belonged to the old exercise
    logEvent('swap', { from: { id: ex.exercise_id, name: ex.exercise_name }, to, scope: swapPlan ? 'plan' : 'today', ...(swapReason ? { reason: swapReason } : {}) });
    setSwapFor(''); setSwapName(''); setSwapId(''); setSwapPlan(false); setSwapReason('');
    await loadDayContext(session.workout_day_id, session);
  }
  function setRow(exId: string, i: number, patch: Partial<SetRow>) {
    setRows(r => ({ ...r, [exId]: r[exId].map((row, idx) => (idx === i ? { ...row, ...patch } : row)) }));
  }

  async function toggleSet(ex: PlanEx, i: number) {
    if (!session) return;
    const key = `${ex.id}:${i}`;
    if (pending.current.has(key)) return; // ignore repeated taps while saving
    pending.current.add(key);
    setError('');
    try {
      const row = rowsRef.current[ex.id][i];
      if (row.done) {
        setRow(ex.id, i, { state: 'saving' });
        if (row.setId) {
          const { error: err } = await supabase.from('exercise_sets').delete().eq('id', row.setId);
          if (err) throw err;
        }
        setRow(ex.id, i, { done: false, setId: undefined, state: undefined });
        return;
      }
      // Fast path: an empty box means "use the suggested number".
      const t = targets[ex.id];
      const p = prev[ex.exercise_name]?.sets[i] ?? prev[ex.exercise_name]?.sets.at(-1);
      const weightStr = row.weight !== '' ? row.weight : t.weight !== null ? String(t.weight) : p ? String(p.weight) : '';
      const repsStr = row.reps !== '' ? row.reps : t.reps !== null ? String(t.reps) : '';
      const isBw = meta[ex.exercise_id ?? '']?.tracking === 'bodyweight_reps';
      const weight = isBw && weightStr === '' ? 0 : parseFloat(weightStr), reps = parseInt(repsStr, 10);
      if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) {
        setError(`Enter weight and reps for ${ex.exercise_name} set ${i + 1}.`);
        return;
      }
      setRow(ex.id, i, { state: 'saving' }); // shown as "Saving", never as saved, until the server confirms
      const logId = await ensureLog(ex);
      let setId = row.setId;
      if (setId) {
        const { error: err } = await supabase.from('exercise_sets').update({ reps, weight, completed: true }).eq('id', setId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('exercise_sets')
          .insert([{ exercise_log_id: logId, set_number: i + 1, reps, weight, completed: true }]).select('id').single();
        if (err || !data) throw err ?? new Error('no set');
        setId = (data as { id: string }).id;
      }
      setRow(ex.id, i, { weight: String(weight), reps: String(reps), done: true, setId, state: undefined });
      startRest(defaultRestSeconds(ex.rep_max));
    } catch {
      setRow(ex.id, i, { state: 'failed' });
      setError('That set did not save. Check your connection and tap the check again. Your numbers are still here.');
    } finally {
      pending.current.delete(key);
    }
  }

  function addSet(ex: PlanEx) {
    setRows(r => ({ ...r, [ex.id]: [...r[ex.id], { weight: '', reps: '', done: false }] }));
  }
  function removeLastSet(ex: PlanEx) {
    setRows(r => {
      const rs = r[ex.id];
      if (rs.length <= 1 || rs[rs.length - 1].done) return r;
      return { ...r, [ex.id]: rs.slice(0, -1) };
    });
  }

  async function discardWorkout() {
    if (!session) return;
    try {
      const { data: logs } = await supabase.from('exercise_logs').select('id').eq('workout_session_id', session.id);
      const ids = (logs ?? []).map(l => (l as { id: string }).id);
      if (ids.length) await supabase.from('exercise_sets').delete().in('exercise_log_id', ids);
      await supabase.from('exercise_logs').delete().eq('workout_session_id', session.id);
      const { error: err } = await supabase.from('workout_sessions').delete().eq('id', session.id);
      if (err) throw err;
      lsSet(LS.draft(session.id), null); stopRest();
      setSession(null); await loadPlanDays(planId);
    } catch {
      setError('Could not discard the workout. Try again.');
    }
  }

  async function finishWorkout() {
    if (!session) return;
    if (doneCount === 0) {
      if (confirm('No sets are logged. Discard this workout?')) await discardWorkout();
      return;
    }
    const unchecked = Object.values(rows).flat().length - doneCount;
    if (unchecked > 0 && !confirm(`${unchecked} set${unchecked === 1 ? '' : 's'} not checked off will be skipped. Finish workout?`)) return;
    try {
      const { error: err } = await supabase.from('workout_sessions')
        .update({ completed_at: new Date().toISOString() }).eq('id', session.id);
      if (err) throw err;
    } catch {
      setError('Could not finish the workout. Your sets are saved. Check your connection and try again.');
      return;
    }
    // Summary. Volume is plain weight x reps; it is not a measure of strength or muscle gain.
    let sets = 0, volume = 0, exCount = 0;
    const prs: Summary['prs'] = [];
    for (const ex of exercises) {
      const done = (rows[ex.id] ?? []).filter(r => r.done);
      if (!done.length) continue;
      exCount++; sets += done.length;
      let top = 0;
      for (const r of done) { volume += parseFloat(r.weight) * parseInt(r.reps, 10); top = Math.max(top, parseFloat(r.weight)); }
      const before = bestWeight[ex.exercise_name];
      if (before !== undefined && top > before) prs.push({ name: ex.exercise_name, weight: top, before });
    }
    const minutes = Math.max(1, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000));
    setSummary({ dayName, minutes, exercises: exCount, sets, volume: Math.round(volume), prs });
    lsSet(LS.draft(session.id), null); stopRest();
    setSession(null);
    await loadPlanDays(planId);
  }

  // ---------- render ----------

  const allRows = Object.values(rows).flat();
  const totalSets = allRows.length, doneSets = allRows.filter(r => r.done).length;
  const currentEx = session ? exercises.find(e => (rows[e.id] ?? []).some(r => !r.done))?.id : undefined;

  const card = 'rounded-2xl bg-fl-s1 border border-fl-line p-4';
  const inputCls = 'h-14 w-full min-w-0 rounded-xl border border-fl-field bg-fl-bg text-center text-2xl font-semibold tabular-nums text-fl-tx outline-none placeholder:text-fl-tx2 focus:border-fl-acc focus-visible:ring-2 focus-visible:ring-fl-acc/50 disabled:opacity-60';

  if (loading) return <main className="mx-auto max-w-xl px-4 pt-6 text-fl-tx"><p className="text-fl-tx2">Loading your workout...</p></main>;

  if (summary) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-28 pt-6 text-fl-tx">
        <h1 className="mb-1 text-3xl font-bold">Workout done</h1>
        <p className="mb-6 text-fl-tx2">{summary.dayName}</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[['Time', `${summary.minutes} min`], ['Exercises', String(summary.exercises)], ['Sets', String(summary.sets)], ['Volume', `${summary.volume.toLocaleString()} lb`]].map(([k, v]) => (
            <div key={k} className={card}><div className="text-xs uppercase tracking-wide text-fl-tx2">{k}</div><div className="text-2xl font-bold tabular-nums">{v}</div></div>
          ))}
        </div>
        <p className="mb-4 text-xs text-fl-tx2">Volume is weight x reps added up. It helps you compare like with like, but it is not a direct measure of strength or muscle gain.</p>
        {summary.prs.length > 0 && (
          <div className={`${card} mb-4`}>
            <div className="mb-2 font-bold text-fl-ok">Heaviest weight yet</div>
            {summary.prs.map(p => <div key={p.name} className="text-sm">{p.name}: {p.weight} lb <span className="text-fl-tx2">(was {p.before})</span></div>)}
          </div>
        )}
        <button onClick={() => setSummary(null)} className="h-12 w-full rounded-xl bg-fl-acc text-base font-bold text-fl-on-acc">Done</button>
      </main>
    );
  }

  if (plans.length === 0 || days.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-6 text-fl-tx">
        <h1 className="mb-4 text-3xl font-bold">Log</h1>
        <div className={card}>
          <p className="mb-4 text-fl-tx2">{plans.length === 0 ? 'You do not have a plan yet.' : 'This plan has no workouts yet.'} Pick a template or build your own, then come back to log.</p>
          <Link href="/plan" className="flex h-12 items-center justify-center rounded-xl bg-fl-acc font-bold text-fl-on-acc">Go to Plan</Link>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-fl-bad">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-44 pt-4 text-fl-tx">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-fl-tx2">{session ? 'Workout in progress' : dayId === suggestedDayId ? 'Up next' : 'Selected workout'}</div>
          <h1 className="truncate text-3xl font-bold">{dayName}</h1>
          <div className="text-sm text-fl-tx2">{plans.find(p => p.id === planId)?.name} · workout {days.findIndex(d => d.id === dayId) + 1} of {days.length}{session && <> · <span className="tabular-nums" aria-label={`Elapsed ${clock(elapsed)}`}>{clock(elapsed)}</span></>}</div>
        </div>
        {session && <button onClick={finishWorkout} className="h-11 shrink-0 rounded-xl bg-fl-acc px-4 font-bold text-fl-on-acc">Finish</button>}
      </div>

      {session && totalSets > 0 && (
        <div className="mb-4" role="progressbar" aria-label="Sets logged" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}>
          <div className="mb-1 flex items-center justify-between text-xs text-fl-tx2">
            <span>{doneSets} of {totalSets} sets logged</span>
            <button onClick={toggleFocus} aria-pressed={focus} className={`h-9 rounded-full px-3 text-xs font-semibold ${focus ? 'bg-fl-tx text-fl-bg' : 'border border-fl-field text-fl-tx'}`}>{focus ? 'Focus mode on' : 'Focus mode'}</button>
          </div>
          <div className="flex gap-[3px]">{Array.from({ length: totalSets }, (_, i) => <i key={i} className={`h-1 flex-1 rounded-sm ${i < doneSets ? 'bg-fl-ok' : 'bg-fl-s2'}`} />)}</div>
        </div>
      )}

      {error && <div role="alert" className="mb-4 rounded-xl bg-fl-s2 p-3 text-sm text-fl-bad">{error}</div>}

      {!session && (
        <div className="mb-4">
          <button onClick={startWorkout} disabled={starting || exercises.length === 0} className="h-14 w-full rounded-2xl bg-fl-acc text-lg font-bold text-fl-on-acc disabled:opacity-50">
            {starting ? 'Starting...' : exercises.length === 0 ? 'No exercises in this workout' : 'Start workout'}
          </button>
          {exercises.length === 0 && (
            <p className="mt-3 text-center text-sm text-fl-tx2">This workout has no exercises yet. <Link href="/plan" className="text-fl-acc underline">Add exercises in Plan</Link>, or choose a different workout.</p>
          )}
          <button onClick={() => setShowPicker(v => !v)} className="mt-3 w-full text-sm text-fl-tx2 underline-offset-2 hover:underline">Choose a different workout</button>
          {showPicker && (
            <div className={`${card} mt-3 space-y-3`}>
              {plans.length > 1 && (
                <label className="block text-xs text-fl-tx2">Plan
                  <select value={planId} onChange={e => changePlan(e.target.value)} className={`${inputCls} mt-1 text-base`}>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-xs text-fl-tx2">Workout
                <select value={dayId} onChange={e => changeDay(e.target.value)} className={`${inputCls} mt-1 text-base`}>
                  {days.map(d => <option key={d.id} value={d.id}>{d.day_name}{d.id === suggestedDayId ? ' (up next)' : ''}{emptyDays.includes(d.id) ? ' (no exercises yet)' : ''}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {focus && session && exercises.length > 0 && (() => {
        const fid = focusId || currentEx || exercises[exercises.length - 1].id;
        const idx = exercises.findIndex(e => e.id === fid);
        return (
          <div className="mb-3 flex items-center justify-between gap-2 text-sm">
            <button disabled={idx <= 0} onClick={() => setFocusId(exercises[idx - 1].id)} className="h-11 rounded-xl bg-fl-s2 px-4 disabled:opacity-40">← Previous</button>
            <span className="text-fl-tx2">Exercise {idx + 1} of {exercises.length}</span>
            <button disabled={idx >= exercises.length - 1} onClick={() => setFocusId(exercises[idx + 1].id)} className="h-11 rounded-xl bg-fl-s2 px-4 disabled:opacity-40">Next →</button>
          </div>
        );
      })()}

      {exercises.map(ex => {
        if (focus && session && ex.id !== (focusId || currentEx || exercises[exercises.length - 1].id)) return null;
        const t = targets[ex.id];
        const p = prev[ex.exercise_name];
        const rs = rows[ex.id] ?? [];
        const m = meta[ex.exercise_id ?? ''];
        const bw = m?.tracking === 'bodyweight_reps';
        const added = m?.tracking === 'added_weight_reps';
        const loadNote = m?.load === 'per_hand' ? 'Weight is per hand' : m?.load === 'per_side' ? 'Weight is per side' : '';
        return (
          <section key={ex.id} className={`${card} mb-3 ${currentEx === ex.id ? '!border-fl-field' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{ex.exercise_name}</h2>
              {session && rs.length > 0 && <span className="shrink-0 text-xs text-fl-tx2">{rs.filter(r => r.done).length}/{rs.length}</span>}
            </div>
            <div className="text-sm text-fl-tx2">{ex.target_sets} sets · {ex.rep_min}-{ex.rep_max} reps{loadNote ? ` · ${loadNote}` : ''}</div>
            {readSwaps(session?.id)[ex.id] && <div className="text-xs text-fl-tx2">Swapped for today from {readSwaps(session?.id)[ex.id].fromName}</div>}
            {session && !rs.some(r => r.done) && (swapFor === ex.id ? (
              <div className="mt-2 rounded-xl bg-fl-s2 p-3">
                <div className="mb-2 text-sm text-fl-tx2">Swap {ex.exercise_name} for:</div>
                <ExercisePicker value={swapName} onChange={setSwapName} onPick={x => setSwapId(x?.id ?? '')} />
                <fieldset className="mb-3">
                  <legend className="mb-1.5 text-xs text-fl-tx2">Why? Optional, helps Forgeload suggest better</legend>
                  <div className="flex flex-wrap gap-2">
                    {SWAP_REASONS.map(r => (
                      <button key={r.id} type="button" aria-pressed={swapReason === r.id} onClick={() => setSwapReason(v => (v === r.id ? '' : r.id))}
                        className={`min-h-9 rounded-full px-3 text-xs ${swapReason === r.id ? 'bg-fl-tx font-semibold text-fl-bg' : 'border border-fl-field'}`}>{r.label}</button>
                    ))}
                  </div>
                </fieldset>
                <label className="mb-3 flex items-center gap-2 text-sm text-fl-tx2"><input type="checkbox" checked={swapPlan} onChange={e => setSwapPlan(e.target.checked)} className="h-5 w-5" />Also change it in my plan</label>
                <div className="flex gap-2">
                  <button onClick={() => doSwap(ex)} className="h-11 flex-1 rounded-xl bg-fl-acc font-bold text-fl-on-acc">Swap</button>
                  <button onClick={() => { setSwapFor(''); setSwapName(''); setSwapId(''); setSwapPlan(false); }} className="h-11 rounded-xl bg-fl-s2 px-4">Cancel</button>
                </div>
                <p className="mt-2 text-xs text-fl-tx2">Only today changes unless you tick the box. Your past sets stay in your history either way.</p>
              </div>
            ) : <button onClick={() => { setSwapFor(ex.id); setSwapName(''); setSwapId(''); }} className="mt-1 h-9 text-sm text-fl-tx2 underline-offset-2 hover:underline">Swap exercise</button>)}
            <details className="mb-3 mt-3 border-l-4 border-fl-acc pl-3">
              <summary className="cursor-pointer list-none py-1">
                <div className="text-[11px] uppercase tracking-wide text-fl-tx2">Target</div>
                <div className="text-2xl font-semibold leading-tight tracking-tight">
                  {t.action === 'start' ? (bw ? `Bodyweight × ${ex.rep_min}-${ex.rep_max}` : `Find a ${ex.rep_min}-${ex.rep_max} rep weight`) : (bw && !t.weight ? `Bodyweight × ${t.reps}` : `${t.weight !== null ? `${t.weight} lb` : 'add load'} × ${t.reps}`)}
                </div>
                <span className="text-xs text-fl-tx2 underline">why this target?</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-fl-tx2">{t.reason}</p>
            </details>

            {focus && session && (() => {
              const ai = rs.findIndex(x => !x.done);
              const r = ai >= 0 ? rs[ai] : null;
              const pv = ai >= 0 ? (p?.sets[ai] ?? p?.sets.at(-1)) : undefined;
              return (
                <div>
                  {rs.some(x => x.done) && (
                    <ul className="mb-3 flex flex-wrap gap-2" aria-label="Saved sets">
                      {rs.map((x, i) => x.done ? <li key={i} className="rounded-lg bg-fl-ok/15 px-2.5 py-1 text-sm tabular-nums text-fl-ok">✓ Set {i + 1}: {x.weight}×{x.reps}</li> : null)}
                    </ul>
                  )}
                  {r ? (
                    <div>
                      <div className="mb-2 flex justify-between text-sm text-fl-tx2">
                        <span>Set {ai + 1} of {rs.length}</span>
                        {pv && <button type="button" onClick={() => setRow(ex.id, ai, { weight: String(pv.weight), reps: String(pv.reps) })} className="underline decoration-dotted underline-offset-4">Last time {pv.weight}×{pv.reps}</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs uppercase tracking-wide text-fl-tx2">{bw || added ? '+Lb' : 'Lb'}
                          <input aria-label={`${ex.exercise_name} set ${ai + 1} weight in pounds`} inputMode="decimal" value={r.weight}
                            placeholder={bw && !t.weight && !pv?.weight ? 'BW' : t.weight !== null ? String(t.weight) : pv ? String(pv.weight) : ''}
                            onChange={e => setRow(ex.id, ai, { weight: clean(e.target.value) })} className={`${inputCls} mt-1 !h-16 !text-3xl`} />
                        </label>
                        <label className="text-xs uppercase tracking-wide text-fl-tx2">Reps
                          <input aria-label={`${ex.exercise_name} set ${ai + 1} reps`} inputMode="numeric" value={r.reps}
                            placeholder={t.reps !== null ? String(t.reps) : ''}
                            onChange={e => setRow(ex.id, ai, { reps: e.target.value.replace(/\D/g, '') })} className={`${inputCls} mt-1 !h-16 !text-3xl`} />
                        </label>
                      </div>
                      <button onClick={() => toggleSet(ex, ai)} disabled={r.state === 'saving'}
                        className={`mt-3 h-16 w-full rounded-2xl text-xl font-bold disabled:opacity-70 ${r.state === 'failed' ? 'bg-fl-bad text-fl-on-acc' : 'bg-fl-acc text-fl-on-acc'}`}>
                        {r.state === 'saving' ? 'Saving…' : r.state === 'failed' ? `Not saved. Retry set ${ai + 1}` : `Complete set ${ai + 1}`}
                      </button>
                      <p className="mt-2 text-center text-xs text-fl-tx2">Empty boxes use the target.</p>
                    </div>
                  ) : <p className="font-semibold text-fl-ok">✓ All sets saved for this exercise.</p>}
                </div>
              );
            })()}

            {!(focus && session) && <>
            <div className="mb-1 grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3.25rem] gap-2 text-center text-[11px] uppercase tracking-wide text-fl-tx2">
              <span>Set</span><span>Previous</span><span>{bw || added ? '+Lb' : 'Lb'}</span><span>Reps</span><span className="sr-only">Done</span>
            </div>
            {rs.map((r, i) => {
              const pv = p?.sets[i] ?? p?.sets.at(-1);
              return (
                <div key={i} className="mb-2">
                <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3.25rem] items-center gap-2">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-bold ${r.done ? 'bg-fl-ok text-fl-on-ok' : r.state === 'failed' ? 'border-2 border-fl-bad text-fl-bad' : currentEx === ex.id && i === rs.findIndex(x => !x.done) ? 'border-2 border-fl-acc text-fl-acc' : 'border border-fl-field text-fl-tx2'}`}>{i + 1}</span>
                  {pv && session && !r.done ? (
                    <button type="button" onClick={() => setRow(ex.id, i, { weight: String(pv.weight), reps: String(pv.reps) })}
                      aria-label={`Use last time: ${pv.weight} pounds for ${pv.reps} reps, for set ${i + 1}`}
                      className="h-12 truncate rounded-lg text-center text-sm tabular-nums text-fl-tx2 underline decoration-dotted underline-offset-4">{pv.weight}×{pv.reps}</button>
                  ) : (
                    <span className="truncate text-center text-sm tabular-nums text-fl-tx2">{pv ? `${pv.weight}×${pv.reps}` : '-'}</span>
                  )}
                  <input
                    aria-label={`${ex.exercise_name} set ${i + 1} weight in pounds`}
                    inputMode="decimal" disabled={!session} value={r.weight}
                    placeholder={bw && !t.weight && !pv?.weight ? 'BW' : t.weight !== null ? String(t.weight) : pv ? String(pv.weight) : ''}
                    onChange={e => setRow(ex.id, i, { weight: clean(e.target.value) })}
                    className={`${inputCls} ${r.done ? 'border-fl-ok/60 bg-fl-ok/10' : ''}`}
                  />
                  <input
                    aria-label={`${ex.exercise_name} set ${i + 1} reps`}
                    inputMode="numeric" disabled={!session} value={r.reps}
                    placeholder={t.reps !== null ? String(t.reps) : ''}
                    onChange={e => setRow(ex.id, i, { reps: e.target.value.replace(/\D/g, '') })}
                    className={`${inputCls} ${r.done ? 'border-fl-ok/60 bg-fl-ok/10' : ''}`}
                  />
                  <button
                    aria-label={r.state === 'saving' ? `Saving set ${i + 1}` : r.state === 'failed' ? `Set ${i + 1} not saved. Retry` : r.done ? `Set ${i + 1} saved. Tap to undo` : `Log set ${i + 1}`} aria-pressed={r.done}
                    disabled={!session || r.state === 'saving'} onClick={() => toggleSet(ex, i)}
                    className={`h-14 w-[3.25rem] rounded-xl text-xl font-bold disabled:opacity-40 ${r.state === 'failed' ? 'border-2 border-fl-bad bg-fl-bad/15 text-fl-bad' : r.done ? 'bg-fl-ok text-fl-on-ok' : 'bg-fl-s2 text-fl-tx2'} ${r.state === 'saving' ? '!opacity-70' : ''}`}
                  >{r.state === 'saving' ? '…' : r.state === 'failed' ? '↻' : '✓'}</button>
                </div>
                {r.state === 'saving' && <p className="mt-1 text-right text-xs text-fl-tx2" role="status">Saving…</p>}
                {r.state === 'failed' && <p className="mt-1 text-right text-xs text-fl-bad" role="alert">Not saved. Tap ↻ to retry.</p>}
                </div>
              );
            })}
            {session && (
              <div className="mt-1 flex gap-4 text-sm">
                <button onClick={() => addSet(ex)} className="text-fl-tx2 underline-offset-2 hover:underline">+ Add set</button>
                {rs.length > 1 && !rs[rs.length - 1].done && <button onClick={() => removeLastSet(ex)} className="text-fl-tx2 underline-offset-2 hover:underline">Remove last set</button>}
              </div>
            )}
            </>}
          </section>
        );
      })}

      {session && (
        <button onClick={() => { if (confirm('Discard this workout and everything logged in it?')) discardWorkout(); }} className="mt-2 w-full py-3 text-sm text-fl-bad">Discard workout</button>
      )}

      {rest && (
        <div role="timer" aria-live="off" className="fixed inset-x-0 bottom-[78px] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-fl-line bg-fl-s2 p-3 shadow-lg" style={{ width: 'calc(100% - 1.5rem)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-fl-tx2">{restLeft === 0 ? 'Rest over' : rest.paused !== undefined ? 'Rest paused' : 'Rest'}</div>
            <div className={`text-3xl font-bold tabular-nums ${restLeft === 0 ? 'text-fl-ok' : ''}`}>{mmss(restLeft)}</div>
          </div>
          {restLeft > 0 && <button onClick={togglePause} aria-pressed={rest.paused !== undefined} className="h-11 rounded-xl border border-fl-field px-3 text-sm">{rest.paused !== undefined ? 'Resume' : 'Pause'}</button>}
          <button onClick={() => adjustRest(-15)} className="h-11 rounded-xl border border-fl-field px-3 text-sm">-15s</button>
          <button onClick={() => adjustRest(15)} className="h-11 rounded-xl border border-fl-field px-3 text-sm">+15s</button>
          <button onClick={stopRest} className="h-11 rounded-xl bg-fl-acc px-4 text-sm font-bold text-fl-on-acc">{restLeft === 0 ? 'Close' : 'Skip'}</button>
        </div>
      )}
    </main>
  );
}
