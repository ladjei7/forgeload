// Browser side of the outbox: one shared queue per signed-in user, persisted in localStorage,
// synced to Supabase in order. Any screen can subscribe to show sync state.
import { supabase } from './supabase';
import { load, save, enqueue, flush, classify, type Op, type Outcome } from './outbox';

type State = { ops: Op[]; syncing: boolean; online: boolean; storageOk: boolean; userId: string };
let st: State = { ops: [], syncing: false, online: true, storageOk: true, userId: '' };
let ready: Promise<void> | null = null;
const listeners = new Set<() => void>();

const key = () => `fl-outbox-${st.userId || 'anon'}`;
const store = {
  get: () => { try { return localStorage.getItem(key()); } catch { return null; } },
  set: (v: string) => { localStorage.setItem(key(), v); },
};
function emit() { for (const l of listeners) l(); }
function persist() { const ok = save(store, st.ops); if (ok !== st.storageOk) st = { ...st, storageOk: ok }; }

/** Load this user's outbox once. Safe to call repeatedly. */
export function ensureInit(): Promise<void> {
  if (!ready) ready = (async () => {
    const { data } = await supabase.auth.getSession(); // local read, works offline
    st = { ...st, userId: data.session?.user.id ?? '' };
    st = { ...st, ops: load(store) };
    // Detect a browser that will not keep anything (private mode, storage blocked).
    try { localStorage.setItem('fl-outbox-probe', '1'); localStorage.removeItem('fl-outbox-probe'); } catch { st = { ...st, storageOk: false }; }
    emit();
  })();
  return ready;
}

export const getState = () => st;
export function subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function addOp(op: Op) { st = { ...st, ops: enqueue(st.ops, op) }; persist(); emit(); }
/** Only for an explicit user action (discarding a workout). */
export function dropSession(sessionId: string) { st = { ...st, ops: st.ops.filter(o => o.sessionId !== sessionId) }; persist(); emit(); }

async function send(op: Op): Promise<Outcome> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'transient';
  if (op.kind === 'log') {
    const { error, status } = await supabase.from('exercise_logs').upsert(op.payload, { onConflict: 'id' });
    const r = classify(error, status);
    if (r === 'ok' && op.payload.exercise_id) supabase.rpc('touch_exercise', { ex: op.payload.exercise_id }).then(() => {}, () => {});
    return r;
  }
  if (op.kind === 'set') {
    const { error, status } = await supabase.from('exercise_sets').upsert(op.payload, { onConflict: 'id' });
    return classify(error, status);
  }
  const { error, status } = await supabase.from('exercise_sets').delete().eq('id', op.setId);
  return classify(error, status);
}

/** Send everything pending, in order. Returns true when nothing is left. */
export async function syncNow(retryFailed = false): Promise<boolean> {
  await ensureInit();
  if (st.syncing) return st.ops.length === 0;
  if (!st.ops.length) return true;
  st = { ...st, syncing: true }; emit();
  try {
    const before = st.ops;
    const r = await flush(before, send, { retryFailed });
    const sent = new Set(before.map(o => o.opId));
    let next = r.remaining;
    for (const o of st.ops) if (!sent.has(o.opId)) next = enqueue(next, o); // taps that happened while sending
    st = { ...st, ops: next, online: !r.stoppedOffline };
    persist();
  } finally {
    st = { ...st, syncing: false }; emit();
  }
  return st.ops.length === 0;
}

let auto = false;
/** Retry when the connection comes back, when the app returns to the foreground, and every 20 seconds while anything is pending. */
export function startAutoSync() {
  if (auto || typeof window === 'undefined') return;
  auto = true;
  window.addEventListener('online', () => { st = { ...st, online: true }; emit(); void syncNow(); });
  window.addEventListener('offline', () => { st = { ...st, online: false }; emit(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
  setInterval(() => { if (st.ops.some(o => !o.failed)) void syncNow(); }, 20000);
}

/** Pending writes for any user on this device (used to warn before signing out). */
export function pendingOnDevice(): number {
  try {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('fl-outbox-') && k !== 'fl-outbox-probe') n += (JSON.parse(localStorage.getItem(k) ?? '[]') as Op[]).filter(o => o.kind === 'set').length;
    }
    return n;
  } catch { return 0; }
}
