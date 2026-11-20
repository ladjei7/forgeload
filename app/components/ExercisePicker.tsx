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

  const row = 'cursor-pointer border-b border-fl-line px-3 py-2.5 last:border-b-0 hover:bg-fl-s1';
  const section = (title: string, list: Result[]) => list.length > 0 && (
    <div key={title}>
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fl-tx2">{title}</div>
      {list.map(e => (
        <div key={e.id} onMouseDown={() => choose(e)} className={row}>
          <div className="font-medium">{e.name}</div>
          <div className="text-xs text-fl-tx2">{e.muscle_group} · {e.equipment}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative mb-3">
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="Search exercises"
          placeholder="Search exercises"
          value={value}
          onChange={e => { onChange(e.target.value); onPick?.(null); setOpen(true); }}
          onFocus={openList}
          onBlur={() => setTimeout(() => { if (!showFiltersRef.current) setOpen(false); }, 150)}
          className="h-12 min-w-0 flex-1 rounded-xl border border-fl-field bg-fl-s2 px-3 text-base text-fl-tx"
        />
        <button
          type="button" aria-pressed={showFilters} aria-label="Filters"
          onClick={() => { setShowFilters(v => !v); setOpen(true); }}
          className={`h-12 shrink-0 rounded-xl border px-4 text-sm font-semibold ${muscle || equip ? 'border-fl-acc bg-fl-tint text-fl-tx' : 'border-fl-field bg-fl-s2 text-fl-tx'}`}
        >
          Filters{muscle || equip ? ' •' : ''}
        </button>
      </div>
      {open && (searching || showFilters || favorites.length > 0 || recents.length > 0) && (
        <div
          onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT') e.preventDefault(); }}
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-fl-line bg-fl-s2 shadow-lg"
        >
          {showFilters && (
            <div className="border-b border-fl-line px-3 pt-3">
              <ExerciseFilters muscle={muscle} equip={equip} onMuscle={setMuscle} onEquip={setEquip} />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
            {failed && <div className="p-3 text-sm text-fl-bad">Search is unavailable right now. You can still add this as a custom exercise.</div>}
            {!searching && <>{section('Favorites', favorites)}{section('Recent', recents)}</>}
            {searching && shown.map(e => (
              <div key={e.id} onMouseDown={() => choose(e)} className={row}>
                <div className="font-medium">{e.name}{e.is_custom ? ' (yours)' : ''}</div>
                <div className="text-xs text-fl-tx2">{e.muscle_group} · {e.equipment}</div>
              </div>
            ))}
            {searching && !failed && shown.length === 0 && (
              <div className="p-3 text-sm text-fl-tx2">
                {muscle || equip ? 'No exercises match these filters. Try clearing one.' : 'No match yet.'}
              </div>
            )}
          </div>
          {q && !exact && (
            <div onMouseDown={addCustom} className="cursor-pointer border-t border-fl-line bg-fl-s1 p-3 text-sm font-semibold text-fl-acc">
              {saving ? 'Adding...' : `+ Add "${q}" as a custom exercise`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
