// Free-tier suggestion: "you keep swapping A for B. Make B the default?" Plain counting, no scoring. Pure functions (no database access) so they are easy to test.
// It only proposes. The caller changes the plan after the user taps Accept, and records Undo.
export type SwapEnd = { id: string | null; name: string };
export type EventRow = { kind: string; payload: Record<string, unknown>; created_at: string };
export type PlanRow = { id: string; workout_day_id: string; exercise_id: string | null; exercise_name: string };
export type SwapSuggestion = { sid: string; from: SwapEnd; to: SwapEnd; count: number; rows: PlanRow[] };

export const WINDOW_DAYS = 30;
export const THRESHOLD = 3;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const keyOf = (e: { id: string | null; name: string }) => e.id ?? `n:${norm(e.name)}`;
const asEnd = (v: unknown): SwapEnd | null => {
  const o = v as { id?: unknown; name?: unknown } | null;
  return o && typeof o.name === 'string' ? { id: typeof o.id === 'string' ? o.id : null, name: o.name } : null;
};

export function swapSuggestions(events: EventRow[], plan: PlanRow[], now = Date.now()): SwapSuggestion[] {
  const since = now - WINDOW_DAYS * 86400000;
  // Latest "handled" decision per suggestion. Accepted and dismissed hide it until NEW swaps happen; undone brings it back.
  const handled = new Map<string, number>();
  const decisions = events.map((e, i) => ({ e, i, t: Date.parse(e.created_at) })).filter(x => x.e.kind === 'suggestion' && !Number.isNaN(x.t))
    .sort((a, b) => a.t - b.t || b.i - a.i); // oldest first; on a tie the one listed first (newest-first input) counts as later
  for (const { e, t } of decisions) {
    const sid = String(e.payload.sid ?? ''); const a = e.payload.action; if (!sid) continue;
    if (a === 'accepted' || a === 'dismissed') handled.set(sid, t);
    else if (a === 'undone') handled.set(sid, 0);
  }
  const groups = new Map<string, { from: SwapEnd; to: SwapEnd; n: number }>();
  for (const e of events) {
    if (e.kind !== 'swap') continue;
    const t = Date.parse(e.created_at); const from = asEnd(e.payload.from); const to = asEnd(e.payload.to);
    if (!from || !to || Number.isNaN(t) || t < since || keyOf(from) === keyOf(to)) continue;
    const sid = `${keyOf(from)}>${keyOf(to)}`;
    if (t <= (handled.get(sid) ?? 0)) continue;
    const g = groups.get(sid) ?? { from, to, n: 0 }; g.n++; groups.set(sid, g);
  }
  const out: SwapSuggestion[] = [];
  for (const [sid, g] of groups) {
    if (g.n < THRESHOLD) continue;
    const rows = plan.filter(r => keyOf({ id: r.exercise_id, name: r.exercise_name }) === keyOf(g.from)
      && !plan.some(o => o.workout_day_id === r.workout_day_id && keyOf({ id: o.exercise_id, name: o.exercise_name }) === keyOf(g.to)));
    if (rows.length) out.push({ sid, from: g.from, to: g.to, count: g.n, rows });
  }
  return out.sort((a, b) => b.count - a.count);
}
