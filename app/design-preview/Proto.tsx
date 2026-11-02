'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './preview.css';
import { Icon } from './ui';
import { SEED_HIST, SEED_PLAN, LIB, computeTarget, fmtW, libOf, estMinutes, generatePlan, totalSets, type Day, type PlanEx, type Target } from './data';
import type { Answers, Ctx, Draft, Net, Screen, SetLog, State, Summary, WEx, Workout } from './ctx';
import { Home, Workout as WorkoutScreen, PlanScreen, Progress, LibraryScreen, Onboard, Review, Complete } from './screens';
import { SheetHost, ProtoControls } from './sheets';

const KEY = 'fl-design-preview-v1';
const RANK: Record<Screen, number> = { onboard: 0, review: 1, home: 2, plan: 3, workout: 4, progress: 5, library: 6, complete: 7 };

const seed = (): State => ({
  screen: 'home', back: false, plan: SEED_PLAN, hist: SEED_HIST, nextDay: 0, lastDay: 3,
  weekDone: [true, false, true, false, true, false, false], today: 6,
  workout: null, net: 'online', theme: 'dark', mode: 'list', fav: ['bench'], recent: ['bench', 'row', 'ohp'], custom: [],
  planSave: 'saved', selDay: 0, exp: null, summary: null,
  ob: { step: 0, a: { days: 4, exp: 'some', goal: 'both', time: 60 } }, draftPlan: null,
  sheet: null, toast: null, fresh: false,
});

export default function Proto() {
  const [s, setS] = useState<State>(seed);
  const [now, setNow] = useState(() => Date.now());
  const [acts, setActs] = useState(0);
  const [costs, setCosts] = useState<number[]>([]);
  const actsRef = useRef(0);
  const lastLogActs = useRef(0);
  const lastLogAt = useRef(0);
  const netRef = useRef<Net>('online');
  const sRef = useRef(s);
  const loaded = useRef(false);
  const [kb, setKb] = useState(false);
  sRef.current = s;
  netRef.current = s.net;

  const lib = useMemo(() => [...LIB, ...s.custom], [s.custom]);
  const set = useCallback((p: Partial<State>) => setS((o) => ({ ...o, ...p })), []);

  // restore (interrupted workout survives a reload) and persist
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) { const o = JSON.parse(raw) as State; setS({ ...seed(), ...o, sheet: null, toast: null }); }
    } catch { /* storage unavailable: run from seed */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...s, sheet: null, toast: null })); } catch { /* ignore */ }
  }, [s]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const f = () => setKb(window.innerHeight - vv.height > 150);
    vv.addEventListener('resize', f); return () => vv.removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    if (!s.toast) return;
    const t = setTimeout(() => setS((o) => ({ ...o, toast: null })), 5000);
    return () => clearTimeout(t);
  }, [s.toast]);

  const go = useCallback((screen: Screen) => setS((o) => ({ ...o, screen, back: RANK[screen] < RANK[o.screen], sheet: null })), []);
  const open = useCallback((t: string, extra?: { a?: string; b?: string; n?: number }) => setS((o) => ({ ...o, sheet: { t, ...extra } })), []);
  const close = useCallback(() => setS((o) => ({ ...o, sheet: null })), []);
  const toast = useCallback((msg: string, undo?: boolean) => setS((o) => ({ ...o, toast: { msg, undo } })), []);

  const targetOf = useCallback((pe: PlanEx): Target => computeTarget(pe, libOf(lib, pe.exId), s.hist[pe.exId]), [lib, s.hist]);

  // ---- save simulation (sets) ----
  const patchSet = useCallback((id: string, status: SetLog['status']) => {
    setS((o) => (o.workout ? { ...o, workout: { ...o.workout, sets: o.workout.sets.map((x) => (x.id === id ? { ...x, status } : x)) } } : o));
  }, []);
  const triggerSave = useCallback((id: string) => {
    const net = netRef.current;
    if (net === 'offline') { patchSet(id, 'queued'); return; }
    patchSet(id, 'saving');
    if (net === 'fail') {
      setTimeout(() => { patchSet(id, 'failed'); setS((o) => ({ ...o, net: 'online' })); }, 800);
    } else setTimeout(() => patchSet(id, 'saved'), net === 'slow' ? 3500 : 650);
  }, [patchSet]);

  useEffect(() => { // coming back online flushes the queue
    if (s.net === 'offline') return;
    s.workout?.sets.filter((x) => x.status === 'queued').forEach((x) => triggerSave(x.id));
    if (s.planSave === 'offline') { setS((o) => ({ ...o, planSave: 'saving' })); setTimeout(() => setS((o) => ({ ...o, planSave: 'saved' })), 700); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.net]);

  // ---- plan save simulation ----
  const savePlanState = useCallback(() => {
    const net = netRef.current;
    if (net === 'offline') { setS((o) => ({ ...o, planSave: 'offline' })); return; }
    setS((o) => ({ ...o, planSave: 'saving' }));
    if (net === 'fail') setTimeout(() => setS((o) => ({ ...o, planSave: 'failed', net: 'online' })), 800);
    else setTimeout(() => setS((o) => ({ ...o, planSave: 'saved' })), net === 'slow' ? 3000 : 600);
  }, []);
  const mutatePlan = useCallback((fn: (d: Day[]) => Day[]) => { setS((o) => ({ ...o, plan: fn(o.plan) })); savePlanState(); }, [savePlanState]);
  const retryPlanSave = useCallback(() => savePlanState(), [savePlanState]);

  // ---- workout ----
  const mkWorkout = useCallback((dayIdx: number, o: State): Workout => {
    const day = o.plan[dayIdx];
    const exs: WEx[] = day.ex.map((e) => ({ ...e, extra: 0 }));
    const draft: Record<string, Draft> = {};
    exs.forEach((e) => { const t = computeTarget(e, libOf([...LIB, ...o.custom], e.exId), o.hist[e.exId]); draft[e.id] = { w: fmtW(t.w), r: String(t.r) }; });
    return { dayId: day.id, dayIdx, startedAt: Date.now(), exs, idx: 0, sets: [], ovr: {}, draft, restEnd: null, restLen: 0 };
  }, []);
  const startWorkout = useCallback((dayIdx: number) => {
    setS((o) => (o.workout ? { ...o, screen: 'workout', back: false, sheet: null } : { ...o, workout: mkWorkout(dayIdx, o), screen: 'workout', back: false, sheet: null }));
    lastLogActs.current = actsRef.current;
  }, [mkWorkout]);

  const logSet = useCallback((peId: string) => {
    const o = sRef.current; const w = o.workout; if (!w) return;
    const we = w.exs.find((e) => e.id === peId); if (!we) return;
    const ex = libOf(lib, we.exId); const d = w.draft[peId];
    const wt = ex.kind === 'bodyweight' ? 0 : parseFloat(d.w); const rp = parseInt(d.r, 10);
    if (!(rp >= 1) || (ex.kind === 'weight' && !(wt > 0))) return;
    if (Date.now() - lastLogAt.current < 500) return; // guards accidental double-tap
    lastLogAt.current = Date.now();
    const n = w.sets.filter((x) => x.peId === peId).length + 1;
    const id = `${peId}-${n}-${Date.now()}`;
    setS((p) => p.workout ? { ...p, recent: [we.exId, ...p.recent.filter((x) => x !== we.exId)].slice(0, 8),
      workout: { ...p.workout, sets: [...p.workout.sets, { id, peId, n, w: wt, r: rp, status: 'saving' }], restEnd: Date.now() + we.rest * 1000, restLen: we.rest } } : p);
    const cost = actsRef.current - lastLogActs.current;
    setCosts((c) => [...c, cost]);
    lastLogActs.current = actsRef.current;
    triggerSave(id);
  }, [lib, triggerSave]);

  const retrySet = useCallback((id: string) => triggerSave(id), [triggerSave]);
  const editDraft = useCallback((peId: string, p: Partial<Draft>) => setS((o) => o.workout ? { ...o, workout: { ...o.workout, draft: { ...o.workout.draft, [peId]: { ...o.workout.draft[peId], ...p } } } } : o), []);
  const stepDraft = useCallback((peId: string, field: 'w' | 'r', dir: 1 | -1, step: number) => {
    setS((o) => {
      if (!o.workout) return o;
      const cur = parseFloat(o.workout.draft[peId]?.[field] ?? '0') || 0;
      const nv = Math.max(0, Math.round((cur + dir * step) * 10) / 10);
      return { ...o, workout: { ...o.workout, draft: { ...o.workout.draft, [peId]: { ...o.workout.draft[peId], [field]: field === 'w' ? fmtW(nv) : String(Math.round(nv)) } } } };
    });
  }, []);

  const finish = useCallback((force?: boolean) => {
    const o = sRef.current; const w = o.workout; if (!w) return;
    const logs = w.sets; const planned = w.exs.reduce((a, e) => a + e.sets + e.extra, 0);
    if (logs.length === 0 && !force) { setS((p) => ({ ...p, sheet: { t: 'finish' } })); return; }
    if (!force && (logs.length < planned || logs.some((x) => x.status === 'failed' || x.status === 'queued'))) { setS((p) => ({ ...p, sheet: { t: 'finish' } })); return; }
    if (logs.length === 0) { setS((p) => ({ ...p, workout: null, screen: 'home', back: true, sheet: null, toast: { msg: 'Workout discarded. Nothing was saved.' } })); return; }
    const hist = { ...o.hist }; const highs: string[] = []; const nextT: { name: string; text: string }[] = [];
    let volume = 0;
    w.exs.forEach((we) => {
      const mine = logs.filter((x) => x.peId === we.id).sort((a, b) => a.n - b.n);
      if (!mine.length) return;
      const ex = libOf(lib, we.exId); const prev = o.hist[we.exId] ?? [];
      mine.forEach((x) => { volume += x.w * x.r; });
      const topW = Math.max(...mine.map((x) => x.w)); const bestR = Math.max(...mine.filter((x) => x.w === topW).map((x) => x.r));
      if (prev.length) {
        const pm = Math.max(...prev.flatMap((s2) => s2.sets.map((x) => x.w)));
        const pr = Math.max(...prev.flatMap((s2) => s2.sets.filter((x) => x.w === topW).map((x) => x.r)), 0);
        if (ex.kind === 'weight' && topW > pm) highs.push(`${ex.name}: ${fmtW(topW)} lb is a new high`);
        else if (ex.kind === 'weight' && topW === pm && bestR > pr) highs.push(`${ex.name}: ${bestR} reps at ${fmtW(topW)} lb, a new best`);
        else if (ex.kind === 'bodyweight' && bestR > Math.max(...prev.flatMap((s2) => s2.sets.map((x) => x.r)))) highs.push(`${ex.name}: ${bestR} reps is a new best`);
      }
      hist[we.exId] = [{ daysAgo: 0, sets: mine.map((x) => ({ w: x.w, r: x.r })) }, ...prev];
      const t = computeTarget(we, ex, hist[we.exId]);
      nextT.push({ name: ex.name, text: ex.kind === 'bodyweight' ? `${t.r} reps` : `${fmtW(t.w)} x ${t.r}` });
    });
    const nextDay = (w.dayIdx + 1) % o.plan.length;
    const wd = [...o.weekDone]; wd[o.today] = true;
    const summary: Summary = {
      dayName: o.plan[w.dayIdx].name, logged: logs.length, planned, skipped: Math.max(0, planned - logs.length), volume: Math.round(volume),
      minutes: Math.max(1, Math.round((Date.now() - w.startedAt) / 60000)), highs, next: nextT,
      nextDayName: o.plan[nextDay].name, nextPos: nextDay + 1, total: o.plan.length, unsynced: logs.filter((x) => x.status !== 'saved').length,
    };
    setS((p) => ({ ...p, hist, workout: null, nextDay, lastDay: w.dayIdx, weekDone: wd, summary, screen: 'complete', back: false, sheet: null }));
  }, [lib]);

  // ---- proto-only scenarios ----
  const reset = useCallback((p?: Partial<State>) => { setS({ ...seed(), theme: sRef.current.theme, mode: sRef.current.mode, ...p }); setActs(0); actsRef.current = 0; setCosts([]); }, []);
  const interrupted = useCallback(() => {
    const o = seed(); const w = mkWorkout(0, o); const t = Date.now();
    const sets: SetLog[] = [1, 2, 3].map((n) => ({ id: `i-b-${n}`, peId: 'ua1', n, w: 135, r: n === 3 ? 7 : 8, status: 'saved' as const }));
    sets.push({ id: 'i-r-1', peId: 'ua2', n: 1, w: 120, r: 8, status: 'saved' }, { id: 'i-r-2', peId: 'ua2', n: 2, w: 120, r: 8, status: 'failed' });
    setS({ ...o, theme: sRef.current.theme, mode: sRef.current.mode, workout: { ...w, startedAt: t - 23 * 60000, idx: 1, sets, draft: { ...w.draft, ua2: { w: '120', r: '8' } } }, screen: 'home' });
  }, [mkWorkout]);

  const ctx: Ctx = { s, lib, now, go, set, open, close, toast, targetOf, startWorkout, logSet, retrySet, editDraft, stepDraft, finish, mutatePlan, retryPlanSave, acts };
  const extra = { reset, interrupted, costs, resetActs: () => { setActs(0); actsRef.current = 0; setCosts([]); lastLogActs.current = 0; }, generate: (a: Answers) => generatePlan(a.days, a.time) };

  const onClickCapture = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,input,select,summary,[role=switch]')) { actsRef.current += 1; setActs(actsRef.current); }
  };
  const onFocus = (e: React.FocusEvent) => {
    const t = e.target as HTMLElement; if (t.tagName === 'INPUT') setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280);
  };

  const showNav = s.screen === 'home' || s.screen === 'plan' || s.screen === 'progress' || s.screen === 'library';
  const tabs: { id: Screen | 'train'; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: Icon.home }, { id: 'plan', label: 'Plan', icon: Icon.plan }, { id: 'train', label: s.workout ? 'Resume' : 'Train', icon: Icon.train },
    { id: 'progress', label: 'Progress', icon: Icon.progress }, { id: 'library', label: 'Library', icon: Icon.lib },
  ];

  return (
    <div className={`fl${kb ? ' kb' : ''}`} data-theme={s.theme}>
      <aside className="fl-side" aria-label="Prototype controls">
        <div><h1 className="fl-h2">Forgeload design preview</h1><p className="fl-sub" style={{ marginTop: 4 }}>Mock data only. Nothing here reads or writes your account. Reload keeps the interrupted-workout state for this tab.</p></div>
        <ProtoControls c={ctx} x={extra} />
      </aside>
      <div className="fl-phone" onClickCapture={onClickCapture} onFocusCapture={onFocus}>
        <div className="fl-strip"><span>Design preview · mock data</span><button onClick={() => open('proto')}>Proto tools</button></div>
        {s.screen === 'onboard' && <Onboard c={ctx} x={extra} />}
        {s.screen === 'review' && <Review c={ctx} />}
        {s.screen === 'home' && <Home c={ctx} />}
        {s.screen === 'workout' && <WorkoutScreen c={ctx} />}
        {s.screen === 'plan' && <PlanScreen c={ctx} />}
        {s.screen === 'progress' && <Progress c={ctx} />}
        {s.screen === 'library' && <LibraryScreen c={ctx} />}
        {s.screen === 'complete' && <Complete c={ctx} />}
        {showNav && (
          <nav className="fl-nav" aria-label="Main">
            {tabs.map((t) => (
              <button key={t.id} className={t.id === 'train' ? 'train' : ''} aria-current={t.id === s.screen ? 'page' : undefined}
                onClick={() => (t.id === 'train' ? startWorkout(s.nextDay) : go(t.id))}>
                <span className="pl">{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
        )}
        <SheetHost c={ctx} x={extra} />
        {s.toast && (
          <div className="fl-toast" role="status">
            <span>{s.toast.msg}</span>
            {s.toast.undo && <button className="fl-btn sm sec" onClick={() => { document.dispatchEvent(new CustomEvent('fl-undo')); set({ toast: null }); }}>Undo</button>}
          </div>
        )}
      </div>
    </div>
  );
}
export type Extra = {
  reset: (p?: Partial<State>) => void; interrupted: () => void; costs: number[]; resetActs: () => void; generate: (a: Answers) => Day[];
};
export { estMinutes, totalSets };
