'use client';
// Free suggestion on Home: "You keep swapping A for B. Make B the default?" Optional, undoable, and nothing changes until the user taps Accept.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadEvents, logEvent } from '../lib/events';
import { swapSuggestions, type PlanRow, type SwapSuggestion } from '../lib/swapSuggestions';

function lsGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }

export default function SwapSuggestionCard() {
  const [sug, setSug] = useState<SwapSuggestion | null>(null);
  const [undo, setUndo] = useState<{ sug: SwapSuggestion; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: plans } = await supabase.from('workout_plans').select('id').order('created_at');
      const ids = ((plans ?? []) as { id: string }[]).map(p => p.id); if (!ids.length) return setSug(null);
      const planId = ids.includes(lsGet('fl-plan') ?? '') ? (lsGet('fl-plan') as string) : ids[ids.length - 1];
      const { data: days } = await supabase.from('workout_days').select('id').eq('plan_id', planId);
      const dayIds = ((days ?? []) as { id: string }[]).map(d => d.id); if (!dayIds.length) return setSug(null);
      const { data: rows } = await supabase.from('plan_exercises').select('id, workout_day_id, exercise_id, exercise_name').in('workout_day_id', dayIds);
      const events = await loadEvents(60);
      setSug(swapSuggestions(events, (rows ?? []) as PlanRow[])[0] ?? null);
    } catch { setSug(null); } // a suggestion is optional: never show an error for it
  }, []);
  useEffect(() => { load(); }, [load]);

  async function accept(s: SwapSuggestion) {
    if (busy) return; setBusy(true); setErr('');
    const done: PlanRow[] = [];
    for (const r of s.rows) {
      const { error } = await supabase.from('plan_exercises').update({ exercise_name: s.to.name, exercise_id: s.to.id }).eq('id', r.id);
      if (error) { for (const d of done) await supabase.from('plan_exercises').update({ exercise_name: d.exercise_name, exercise_id: d.exercise_id }).eq('id', d.id); setBusy(false); return setErr('Could not change your plan. Nothing was changed.'); }
      done.push(r);
    }
    logEvent('suggestion', { sid: s.sid, action: 'accepted' });
    setUndo({ sug: s, msg: `Done. ${s.to.name} replaces ${s.from.name} in your plan. Your past sets stay in your history.` }); setSug(null); setBusy(false);
  }
  async function undoAccept() {
    if (!undo || busy) return; setBusy(true);
    for (const r of undo.sug.rows) await supabase.from('plan_exercises').update({ exercise_name: r.exercise_name, exercise_id: r.exercise_id }).eq('id', r.id);
    logEvent('suggestion', { sid: undo.sug.sid, action: 'undone' });
    setUndo(null); setBusy(false); await load();
  }
  function dismiss(s: SwapSuggestion) { logEvent('suggestion', { sid: s.sid, action: 'dismissed' }); setSug(null); }

  if (undo) return (
    <section className="flex items-center justify-between gap-3 rounded-2xl bg-[#111] p-4 text-sm">
      <span className="text-green-400">{undo.msg}</span>
      <button onClick={undoAccept} disabled={busy} className="h-10 shrink-0 rounded-xl border border-green-400 px-4 text-green-400">Undo</button>
    </section>
  );
  if (!sug) return null;
  const n = sug.rows.length;
  return (
    <section className="rounded-2xl bg-[#111] p-5" aria-label="Suggestion">
      <div className="text-xs uppercase tracking-wide text-[#777]">Suggestion · optional</div>
      <h2 className="mb-1 mt-1 text-lg font-bold">Use {sug.to.name} instead of {sug.from.name}?</h2>
      <p className="mb-3 text-sm text-[#aaa]">You swapped it {sug.count} times in the last month. Making it the default saves you the swap{n > 1 ? ` in ${n} workouts` : ''}. Your past {sug.from.name} sets stay in your history.</p>
      {err && <p role="alert" className="mb-2 text-sm text-red-300">{err}</p>}
      <div className="flex gap-2">
        <button onClick={() => accept(sug)} disabled={busy} className="h-11 flex-1 rounded-xl bg-green-400 font-bold text-black disabled:opacity-60">{busy ? 'Saving...' : 'Make it the default'}</button>
        <button onClick={() => dismiss(sug)} disabled={busy} className="h-11 rounded-xl bg-[#222] px-4 text-sm">No thanks</button>
      </div>
    </section>
  );
}
