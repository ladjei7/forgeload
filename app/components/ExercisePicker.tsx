'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import ExerciseFilters from './ExerciseFilters';

export type PickedExercise = { id: string; name: string };

type Result = {
  id: string; name: string; muscle_group: string | null; equipment: string | null;
  tracking_type: string; load_convention: string; is_custom: boolean;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Search runs in the database (search_exercises): abbreviations, aliases, typo tolerance,
// ranking, filters, and a 50-result cap, so the app never downloads the whole catalog.
export default function ExercisePicker({
  value, onChange, onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (ex: PickedExercise | null) => void;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [favorites, setFavorites] = useState<Result[]>([]);
  const [recents, setRecents] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [muscle, setMuscle] = useState('');
  const [equip, setEquip] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const reqId = useRef(0);
  const showFiltersRef = useRef(false);
  useEffect(() => { showFiltersRef.current = showFilters; }, [showFilters]);
  const loadedShortcuts = useRef(false);

  const q = value.trim();
  const searching = q !== '' || muscle !== '' || equip !== '';

  useEffect(() => {
    if (!searching) return;
    const mine = ++reqId.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_exercises', { q, muscle: muscle || null, equip: equip || null, lim: 20 });
      if (mine !== reqId.current) return; // a newer search started; ignore this one
      if (error) { setFailed(true); setResults([]); return; }
      setFailed(false);
      setResults((data ?? []) as Result[]);
    }, 150);
    return () => clearTimeout(t);
  }, [q, muscle, equip, searching]);

  async function openList() {
    setOpen(true);
    if (loadedShortcuts.current) return;
    loadedShortcuts.current = true;
    const [f, r] = await Promise.all([
      supabase.rpc('my_exercises', { kind: 'favorite', lim: 8 }),
      supabase.rpc('my_exercises', { kind: 'recent', lim: 8 }),
    ]);
    setFavorites((f.data ?? []) as Result[]);
    setRecents((r.data ?? []) as Result[]);
  }

  const shown = searching ? results : [];
  const exact = shown.some(r => norm(r.name) === norm(value));

  function choose(e: { id: string; name: string }) {
    onChange(e.name); onPick?.({ id: e.id, name: e.name }); setOpen(false);
  }

  async function addCustom() {
    const name = value.trim();
    if (!name || saving) return;
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) { setSaving(false); setFailed(true); return; }
    const { data, error } = await supabase
      .from('exercises').insert([{ user_id: uid, name, muscle_group: muscle || 'Other', equipment: equip || 'Other' }]).select('id').single();
    setSaving(false);
    if (error || !data) { setFailed(true); return; }
    onPick?.({ id: (data as { id: string }).id, name });
    setOpen(false);
  }

  const rowStyle = { padding: '0.75rem', borderBottom: '1px solid #222', cursor: 'pointer' } as const;
  const section = (title: string, list: Result[]) => list.length > 0 && (
    <div key={title}>
      <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#777' }}>{title}</div>
      {list.map(e => (
        <div key={e.id} onMouseDown={() => choose(e)} style={rowStyle}>
          <div style={{ fontSize: '15px' }}>{e.name}</div>
          <div style={{ fontSize: '12px', color: '#777' }}>{e.muscle_group} · {e.equipment}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          aria-label="Search exercises"
          placeholder="Search exercises (try bench, RDL, pendulum)"
          value={value}
          onChange={e => { onChange(e.target.value); onPick?.(null); setOpen(true); }}
          onFocus={openList}
          onBlur={() => setTimeout(() => { if (!showFiltersRef.current) setOpen(false); }, 150)}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
        />
        <button
          type="button" aria-pressed={showFilters} aria-label="Filters"
          onClick={() => { setShowFilters(v => !v); setOpen(true); }}
          style={{ padding: '0 0.9rem', borderRadius: '8px', border: '1px solid #333', background: (muscle || equip) ? '#fff' : '#1a1a1a', color: (muscle || equip) ? '#000' : '#fff', fontSize: '14px', cursor: 'pointer' }}
        >
          Filters{muscle || equip ? ' •' : ''}
        </button>
      </div>
      {open && (searching || showFilters || favorites.length > 0 || recents.length > 0) && (
        <div
          onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT') e.preventDefault(); }}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', marginTop: '4px', zIndex: 50, overflow: 'hidden' }}
        >
          {showFilters && (
            <div style={{ padding: '0.75rem 0.75rem 0', borderBottom: '1px solid #222' }}>
              <ExerciseFilters muscle={muscle} equip={equip} onMuscle={setMuscle} onEquip={setEquip} />
            </div>
          )}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {failed && <div style={{ padding: '0.75rem', color: '#f87171', fontSize: '13px' }}>Search is unavailable right now. You can still add this as a custom exercise.</div>}
            {!searching && <>{section('Favorites', favorites)}{section('Recent', recents)}</>}
            {searching && shown.map(e => (
              <div key={e.id} onMouseDown={() => choose(e)} style={rowStyle}>
                <div style={{ fontSize: '15px' }}>{e.name}{e.is_custom ? ' (yours)' : ''}</div>
                <div style={{ fontSize: '12px', color: '#777' }}>{e.muscle_group} · {e.equipment}</div>
              </div>
            ))}
            {searching && !failed && shown.length === 0 && (
              <div style={{ padding: '0.75rem', color: '#777', fontSize: '13px' }}>
                {muscle || equip ? 'No exercises match these filters. Try clearing one.' : 'No match yet.'}
              </div>
            )}
          </div>
          {q && !exact && (
            <div onMouseDown={addCustom} style={{ padding: '0.75rem', color: '#4ade80', cursor: 'pointer', fontSize: '14px', borderTop: '1px solid #333', background: '#111' }}>
              {saving ? 'Adding...' : `+ Add "${q}" as a custom exercise`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
