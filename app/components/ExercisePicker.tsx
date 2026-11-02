'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type PickedExercise = { id: string; name: string };

type Result = {
  id: string; name: string; muscle_group: string | null; equipment: string | null;
  tracking_type: string; load_convention: string; is_custom: boolean;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Search runs in the database (search_exercises): abbreviations, aliases, typo tolerance,
// ranking, and a 50-result cap, so the app never downloads the whole catalog.
export default function ExercisePicker({
  value, onChange, onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (ex: PickedExercise | null) => void;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (!q) return;
    const mine = ++reqId.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_exercises', { q, lim: 20 });
      if (mine !== reqId.current) return; // a newer search started; ignore this one
      if (error) { setFailed(true); setResults([]); return; }
      setFailed(false);
      setResults((data ?? []) as Result[]);
    }, 150);
    return () => clearTimeout(t);
  }, [value]);

  const shown = value.trim() ? results : [];
  const exact = shown.some(r => norm(r.name) === norm(value));

  async function addCustom() {
    const name = value.trim();
    if (!name || saving) return;
    setSaving(true);
    // user_id defaults to the signed-in user in the database.
    const { data, error } = await supabase
      .from('exercises').insert([{ name, muscle_group: 'Other', equipment: 'Other' }]).select('id').single();
    setSaving(false);
    if (error || !data) { setFailed(true); return; }
    onPick?.({ id: (data as { id: string }).id, name });
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <input
        type="text"
        placeholder="Search exercises (try bench, RDL, pendulum)"
        value={value}
        onChange={e => { onChange(e.target.value); onPick?.(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
      />
      {open && value.trim() && (
        <div
          onMouseDown={e => e.preventDefault()}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', marginTop: '4px', zIndex: 50, overflow: 'hidden' }}
        >
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {failed && <div style={{ padding: '0.75rem', color: '#f87171', fontSize: '13px' }}>Search is unavailable right now. You can still add this as a custom exercise.</div>}
            {shown.map(e => (
              <div
                key={e.id}
                onMouseDown={() => { onChange(e.name); onPick?.({ id: e.id, name: e.name }); setOpen(false); }}
                style={{ padding: '0.75rem', borderBottom: '1px solid #222', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '15px' }}>{e.name}{e.is_custom ? ' (yours)' : ''}</div>
                <div style={{ fontSize: '12px', color: '#777' }}>{e.muscle_group} · {e.equipment}</div>
              </div>
            ))}
            {!failed && shown.length === 0 && <div style={{ padding: '0.75rem', color: '#777', fontSize: '13px' }}>No match yet.</div>}
          </div>
          {!exact && (
            <div onMouseDown={addCustom} style={{ padding: '0.75rem', color: '#4ade80', cursor: 'pointer', fontSize: '14px', borderTop: '1px solid #333', background: '#111' }}>
              {saving ? 'Adding...' : `+ Add "${value.trim()}" as a custom exercise`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
