// Durable set saving: a small on-device outbox of pending writes.
//
// Why: a set tapped with no signal must not be lost on refresh or app close. Every write gets a
// stable id created on the device, is stored here first, then sent with upsert-by-id, so retries
// can never create duplicates. An op leaves the outbox only after the server confirms it, or when
// the user explicitly discards the workout.
//
// Pure functions plus an injectable storage, so the rules are unit tested without a browser.

export type LogPayload = {
  id: string; workout_session_id: string; exercise_name: string; exercise_id: string | null;
  target_sets: number; target_rep_min: number; target_rep_max: number;
};
export type SetPayload = { id: string; exercise_log_id: string; set_number: number; reps: number; weight: number; completed: true };

type Base = { opId: string; sessionId: string; at: number; failed?: string };
export type Op =
  | (Base & { kind: 'log'; payload: LogPayload })
  | (Base & { kind: 'set'; peId: string; idx: number; payload: SetPayload })
  | (Base & { kind: 'del'; peId: string; idx: number; setId: string });

export type Outcome = 'ok' | 'transient' | 'permanent';
export type Store = { get(): string | null; set(v: string): void };

export function load(store: Store): Op[] {
  try { const v = JSON.parse(store.get() ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function save(store: Store, ops: Op[]): boolean {
  try { store.set(JSON.stringify(ops)); return true; } catch { return false; }
}

/** Add an op, collapsing ones it makes pointless. Never drops a write the server has not confirmed unless it is superseded. */
export function enqueue(ops: Op[], op: Op): Op[] {
  if (op.kind === 'log') return ops.some(o => o.kind === 'log' && o.payload.id === op.payload.id) ? ops : [...ops, op];
  const setId = op.kind === 'set' ? op.payload.id : op.setId;
  // A newer edit or delete of the same set replaces older pending ones for it.
  const kept = ops.filter(o => !((o.kind === 'set' && o.payload.id === setId) || (o.kind === 'del' && o.setId === setId)));
  return [...kept, op];
}

/** Classify a Supabase response. Network trouble and server overload retry; anything the server rejected on purpose does not loop. */
export function classify(error: { message?: string; code?: string } | null | undefined, status?: number): Outcome {
  if (!error) return 'ok';
  if (status === undefined || status === 0 || status === 408 || status === 429 || status >= 500) return 'transient';
  if (/fetch|network|timeout|offline/i.test(error.message ?? '') && !error.code) return 'transient';
  return 'permanent';
}

/**
 * Send pending ops in order. Stops at the first transient failure (keeps it and everything after).
 * A permanent failure is kept in the outbox, marked failed, and skipped until the user retries.
 */
export async function flush(ops: Op[], send: (op: Op) => Promise<Outcome>, opts: { retryFailed?: boolean } = {}):
  Promise<{ remaining: Op[]; confirmed: Op[]; stoppedOffline: boolean }> {
  const remaining: Op[] = []; const confirmed: Op[] = []; let stopped = false;
  const failedLogs = new Set<string>();
  for (const op of ops) {
    if (stopped) { remaining.push(op); continue; }
    if (op.failed && !opts.retryFailed) { remaining.push(op); if (op.kind === 'log') failedLogs.add(op.payload.id); continue; }
    // A set whose log could not be created would only fail too; keep it waiting.
    if (op.kind === 'set' && failedLogs.has(op.payload.exercise_log_id)) { remaining.push(op); continue; }
    let r: Outcome;
    try { r = await send(op); } catch { r = 'transient'; }
    if (r === 'ok') confirmed.push(op);
    else if (r === 'transient') { stopped = true; remaining.push({ ...op, failed: undefined }); }
    else { remaining.push({ ...op, failed: 'rejected' }); if (op.kind === 'log') failedLogs.add(op.payload.id); }
  }
  return { remaining, confirmed, stoppedOffline: stopped };
}

export const forSession = (ops: Op[], sessionId: string) => ops.filter(o => o.sessionId === sessionId);
export const withoutSession = (ops: Op[], sessionId: string) => ops.filter(o => o.sessionId !== sessionId);

/** What the device knows about a set that the server may not: pending ('local'), rejected ('failed'), or deleted. */
export function overlay(ops: Op[], sessionId: string):
  { sets: { peId: string; idx: number; payload: SetPayload; failed: boolean }[]; deleted: Set<string>; logIds: Record<string, string> } {
  const sets: { peId: string; idx: number; payload: SetPayload; failed: boolean }[] = []; const deleted = new Set<string>(); const logIds: Record<string, string> = {};
  for (const o of forSession(ops, sessionId)) {
    if (o.kind === 'set') sets.push({ peId: o.peId, idx: o.idx, payload: o.payload, failed: !!o.failed });
    else if (o.kind === 'del') deleted.add(o.setId);
    else logIds[o.payload.exercise_name] = o.payload.id;
  }
  return { sets, deleted, logIds };
}

export const newId = (): string =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
