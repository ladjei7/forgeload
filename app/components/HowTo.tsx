'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseSteps, videoSearchUrl } from '../lib/howto';

export type HowToInfo = { instructions: string | null; muscle?: string | null; equipment?: string | null };

// One fetch per exercise per page load, shared by every HowTo on the screen.
const cache = new Map<string, Promise<HowToInfo | null>>();
function fetchInfo(id: string): Promise<HowToInfo | null> {
  let p = cache.get(id);
  if (!p) {
    p = Promise.resolve(supabase.from('exercises').select('instructions, muscle_group, equipment').eq('id', id).maybeSingle())
      .then(({ data, error }) => {
        if (error) throw error;
        return data ? { instructions: data.instructions, muscle: data.muscle_group, equipment: data.equipment } : null;
      });
    p.catch(() => cache.delete(id)); // allow a retry after a network failure
    cache.set(id, p);
  }
  return p;
}

/**
 * "How to do it" toggle for one exercise: written steps from the library plus a video search link.
 * Pass `info` when the screen already loaded it (the workout screen does, so it works offline);
 * otherwise it is fetched the first time someone opens it.
 */
export default function HowTo({ name, exerciseId, info, compact }: { name: string; exerciseId: string | null; info?: HowToInfo | null; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<HowToInfo | null | undefined>(info);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const data = info !== undefined ? info : loaded;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && data === undefined && exerciseId) {
      setState('loading');
      try { setLoaded(await fetchInfo(exerciseId)); setState('idle'); } catch { setState('error'); }
    }
  }

  const steps = parseSteps(data?.instructions);
  return (
    <div className="mt-1">
      <button type="button" onClick={toggle} aria-expanded={open}
        className={`inline-flex items-center gap-1 text-sm font-semibold text-fl-acc underline-offset-2 hover:underline ${compact ? 'h-8' : 'h-9'}`}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> How to do it
      </button>
      {open && (
        <div className="mb-2 mt-1 rounded-xl bg-fl-s2 p-3 text-sm leading-relaxed">
          {(data?.muscle || data?.equipment) && (
            <div className="mb-2 text-xs text-fl-tx2">{[data?.muscle && `Works: ${data.muscle}`, data?.equipment && `Uses: ${data.equipment}`].filter(Boolean).join(' · ')}</div>
          )}
          <a href={videoSearchUrl(name)} target="_blank" rel="noopener noreferrer"
            className="mb-3 inline-flex h-10 items-center rounded-xl border border-fl-field px-3 font-semibold text-fl-acc">
            Watch a video <span aria-hidden="true" className="ml-1">↗</span><span className="sr-only"> (opens YouTube in a new tab)</span>
          </a>
          {state === 'loading' && <p className="text-fl-tx2">Loading…</p>}
          {state === 'error' && <p className="text-fl-tx2">Couldn&apos;t load the steps. Check your connection and tap again, or use the video link.</p>}
          {state === 'idle' && (steps.length > 0
            ? <ol className="list-decimal space-y-1 pl-5">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            : <p className="text-fl-tx2">No written steps for this exercise yet.</p>)}
          <p className="mt-2 text-xs text-fl-tx2">Start light while you learn the movement. If something hurts (not just effort), stop and swap the exercise.</p>
        </div>
      )}
    </div>
  );
}
