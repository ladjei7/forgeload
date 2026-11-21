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
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keyboard: arrow keys move through the results, Escape closes the list.
  const moveFocus = (from: Element | null, dir: 1 | -1) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-result]') ?? [])];
    const i = from ? items.indexOf(from as HTMLButtonElement) : -1;
    const next = items[i + dir];
    if (next) next.focus(); else if (dir === -1) inputRef.current?.focus();
  };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); moveFocus(document.activeElement, e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.focus(); }
  };
  const leaving = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && (listRef.current?.contains(to) || to === inputRef.current)) return; // still inside the picker
    setTimeout(() => { if (!showFiltersRef.current) setOpen(false); }, 150);
  };
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

  const row = 'block w-full cursor-pointer border-b border-fl-line px-3 py-2.5 text-left last:border-b-0 hover:bg-fl-s1 focus:bg-fl-s1 focus:outline-none';
  const section = (title: string, list: Result[]) => list.length > 0 && (
    <div key={title}>
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fl-tx2">{title}</div>
      {list.map(e => (
        <button type="button" data-result key={e.id} onClick={() => choose(e)} className={row}>
          <span className="block font-medium">{e.name}</span>
          <span className="block text-xs text-fl-tx2">{e.muscle_group} · {e.equipment}</span>
        </button>
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
          ref={inputRef}
          onBlur={leaving}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); moveFocus(null, 1); } else if (e.key === 'Escape') setOpen(false); }}
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
          ref={listRef} role="group" aria-label="Exercise results" onKeyDown={onListKey} onBlur={leaving}
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
              <button type="button" data-result key={e.id} onClick={() => choose(e)} className={row}>
                <span className="block font-medium">{e.name}{e.is_custom ? ' (yours)' : ''}</span>
                <span className="block text-xs text-fl-tx2">{e.muscle_group} · {e.equipment}</span>
              </button>
            ))}
            {searching && !failed && shown.length === 0 && (
              <div className="p-3 text-sm text-fl-tx2">
                {muscle || equip ? 'No exercises match these filters. Try clearing one.' : 'No match yet.'}
              </div>
            )}
          </div>
          {q && !exact && (
            <button type="button" data-result onClick={addCustom} className="block w-full cursor-pointer border-t border-fl-line bg-fl-s1 p-3 text-left text-sm font-semibold text-fl-acc focus:outline-none focus:ring-2 focus:ring-fl-acc">
              {saving ? 'Adding...' : `+ Add "${q}" as a custom exercise`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
