'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import ExerciseFilters, { clearFacetCache, useFacets } from '../components/ExerciseFilters';

type Ex = {
  id: string; name: string; muscle_group: string | null; equipment: string | null;
  tracking_type: string; load_convention: string; is_custom: boolean; archived_at?: string | null;
  aliases?: string[]; instructions?: string | null;
};
type Tab = 'all' | 'favorites' | 'recent' | 'mine';
type Form = { id?: string; name: string; muscle: string; equipment: string; tracking: string; load: string; aliases: string; notes: string };

const PAGE = 30;
const TRACKING: Record<string, string> = {
  weight_reps: 'Weight × reps', bodyweight_reps: 'Bodyweight reps', added_weight_reps: 'Added weight × reps',
};
const LOAD: Record<string, string> = { total: 'Total weight', per_hand: 'Per hand (each dumbbell)', per_side: 'Per side' };
const FALLBACK_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms', 'Other'];
const FALLBACK_EQUIP = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Smith Machine', 'Kettlebell', 'Bodyweight', 'Band', 'Other'];
const EMPTY: Form = { name: '', muscle: '', equipment: '', tracking: 'weight_reps', load: 'total', aliases: '', notes: '' };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const field = 'h-12 w-full min-w-0 rounded-xl border border-fl-field bg-fl-bg px-3 text-base text-fl-tx outline-none focus:border-fl-acc focus-visible:ring-2 focus-visible:ring-fl-acc/50';
const card = 'rounded-2xl bg-fl-s1 border border-fl-line p-4';

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equip, setEquip] = useState('');
  const [items, setItems] = useState<Ex[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const reqId = useRef(0);
  const { muscles, equipment } = useFacets();

  const muscleOptions = useMemo(() => [...new Set([...muscles.map(m => m.value), ...FALLBACK_MUSCLES])], [muscles]);
  const equipOptions = useMemo(() => [...new Set([...equipment.map(m => m.value), ...FALLBACK_EQUIP])], [equipment]);

  const loadFavs = useCallback(async () => {
    const { data } = await supabase.from('user_exercise_prefs').select('exercise_id').eq('is_favorite', true);
    setFavs(new Set((data ?? []).map(r => (r as { exercise_id: string }).exercise_id)));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { void loadFavs(); }, 0);
    return () => clearTimeout(t);
  }, [loadFavs]);

  const load = useCallback(async (append: boolean, offset: number) => {
    const mine = ++reqId.current;
    setLoading(true); setError('');
    try {
      let rows: Ex[] = [];
      let more = false;
      if (tab === 'all') {
        const { data, error: err } = await supabase.rpc('search_exercises', {
          q: q.trim(), muscle: muscle || null, equip: equip || null, lim: PAGE, off: offset,
        });
        if (err) throw err;
        rows = (data ?? []) as Ex[]; more = rows.length === PAGE;
      } else if (tab === 'favorites' || tab === 'recent') {
        const { data, error: err } = await supabase.rpc('my_exercises', { kind: tab === 'favorites' ? 'favorite' : 'recent', lim: 30 });
        if (err) throw err;
        rows = ((data ?? []) as Ex[]).filter(e => (!muscle || e.muscle_group === muscle) && (!equip || e.equipment === equip));
      } else {
        const { data, error: err } = await supabase
          .from('exercises')
          .select('id, name, muscle_group, equipment, tracking_type, load_convention, archived_at, aliases, instructions')
          .not('user_id', 'is', null).order('name');
        if (err) throw err;
        rows = ((data ?? []) as Ex[]).map(e => ({ ...e, is_custom: true }))
          .filter(e => (!muscle || e.muscle_group === muscle) && (!equip || e.equipment === equip) && (!q.trim() || norm(e.name).includes(norm(q))));
      }
      if (mine !== reqId.current) return;
      setItems(prev => (append ? [...prev, ...rows] : rows));
      setHasMore(more);
    } catch {
      if (mine === reqId.current) setError('Could not load exercises. Check your connection and try again.');
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, [tab, q, muscle, equip]);

  useEffect(() => {
    const t = setTimeout(() => { load(false, 0); }, 150);
    return () => clearTimeout(t);
  }, [load]);

  async function toggleFav(ex: Ex) {
    const on = !favs.has(ex.id);
    setFavs(prev => { const n = new Set(prev); if (on) n.add(ex.id); else n.delete(ex.id); return n; });
    const { error: err } = await supabase.rpc('set_favorite', { ex: ex.id, fav: on });
    if (err) { setError('Could not update the favorite.'); loadFavs(); }
  }

  function startNew(from?: Ex, duplicate = false) {
    setFormError('');
    setForm(from ? {
      id: duplicate ? undefined : from.id,
      name: duplicate ? `${from.name} (copy)` : from.name,
      muscle: from.muscle_group ?? '', equipment: from.equipment ?? '',
      tracking: from.tracking_type in TRACKING ? from.tracking_type : 'weight_reps',
      load: from.load_convention in LOAD ? from.load_convention : 'total',
      aliases: (from.aliases ?? []).join(', '), notes: from.instructions ?? '',
    } : { ...EMPTY, name: q.trim() });
  }

  async function saveForm() {
    if (!form || saving) return;
    const name = form.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) return setFormError('Give the exercise a name (2 to 80 characters).');
    if (!form.muscle) return setFormError('Choose the primary muscle.');
    if (!form.equipment) return setFormError('Choose the equipment.');
    setSaving(true); setFormError('');
    try {
      // Block an exact duplicate of something you can already see (your own or built-in).
      const { data: dupes } = await supabase.rpc('search_exercises', { q: name, lim: 10 });
      const clash = ((dupes ?? []) as Ex[]).find(d => norm(d.name) === norm(name) && d.id !== form.id);
      if (clash) { setFormError(`"${clash.name}" already exists. Search for it instead of creating a copy.`); return; }
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error('You are signed out. Sign in again.');
      const row = {
        name, muscle_group: form.muscle, equipment: form.equipment,
        tracking_type: form.tracking, load_convention: form.load,
        aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
        instructions: form.notes.trim() || null,
      };
      const { data: wrote, error: err } = form.id
        ? await supabase.from('exercises').update(row).eq('id', form.id).select('id')
        : await supabase.from('exercises').insert([{ ...row, user_id: uid }]);
      if (err) throw err;
      if (form.id && (!wrote || wrote.length === 0)) throw new Error('The database did not allow this edit. Run migration 004 in Supabase.');
      clearFacetCache();
      setNote(form.id ? 'Saved.' : `Created "${name}".`);
      setForm(null); setTab('mine'); await load(false, 0);
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      setFormError(`Could not save${msg ? `: ${msg}` : '. Check your connection and try again.'}`);
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(ex: Ex, archived: boolean) {
    if (archived && !confirm(`Archive "${ex.name}"? It will stop appearing in search. Your logged workouts keep it, and you can restore it anytime.`)) return;
    const { data: upd, error: err } = await supabase.from('exercises')
      .update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', ex.id).select('id');
    if (err || !upd || upd.length === 0) return setError('Could not update the exercise. Run migration 004 in Supabase, then try again.');
    clearFacetCache(); setNote(archived ? 'Archived.' : 'Restored.'); await load(false, 0);
  }

  async function deleteExercise(ex: Ex) {
    if (!confirm(`Delete "${ex.name}" for good? Plans and past workouts that used it keep the name and your numbers. This cannot be undone.`)) return;
    const { data: gone, error: err } = await supabase.from('exercises').delete().eq('id', ex.id).select('id');
    if (err) return setError(`Could not delete: ${err.message}`);
    if (!gone || gone.length === 0) return setError('Delete was not allowed by the database. Run migration 004 in Supabase, then try again.');
    clearFacetCache(); setOpenId(''); setNote('Deleted.'); await load(false, 0); void loadFavs();
  }

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${tab === t ? 'bg-fl-acc text-fl-on-acc' : 'bg-fl-s2 text-fl-tx2'}`}>{label}</button>
  );

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-4 text-fl-tx">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Exercises</h1>
        <button onClick={() => startNew()} className="h-11 rounded-xl bg-fl-acc px-4 font-bold text-fl-on-acc">+ New</button>
      </div>

      {form && (
        <section className={`${card} mb-4`} aria-label={form.id ? 'Edit exercise' : 'New exercise'}>
          <h2 className="mb-3 text-lg font-bold">{form.id ? 'Edit exercise' : 'New exercise'}</h2>
          <div className="space-y-3">
            <label className="block text-xs text-fl-tx2">Name
              <input className={`${field} mt-1`} value={form.name} maxLength={80} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block text-xs text-fl-tx2">Primary muscle
              <select className={`${field} mt-1`} value={form.muscle} onChange={e => setForm({ ...form, muscle: e.target.value })}>
                <option value="">Choose...</option>{muscleOptions.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-xs text-fl-tx2">Equipment
              <select className={`${field} mt-1`} value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })}>
                <option value="">Choose...</option>{equipOptions.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-xs text-fl-tx2">How you log it
              <select className={`${field} mt-1`} value={form.tracking} onChange={e => setForm({ ...form, tracking: e.target.value })}>
                {Object.entries(TRACKING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block text-xs text-fl-tx2">Weight means
              <select className={`${field} mt-1`} value={form.load} onChange={e => setForm({ ...form, load: e.target.value })}>
                {Object.entries(LOAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block text-xs text-fl-tx2">Other names to search by (optional, comma separated)
              <input className={`${field} mt-1`} value={form.aliases} onChange={e => setForm({ ...form, aliases: e.target.value })} />
            </label>
            <label className="block text-xs text-fl-tx2">Notes (optional)
              <textarea className={`${field} mt-1 h-24 py-2`} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          {formError && <p role="alert" className="mt-3 text-sm text-fl-bad">{formError}</p>}
          <div className="mt-4 flex gap-3">
            <button onClick={saveForm} disabled={saving} className="h-12 flex-1 rounded-xl bg-fl-acc font-bold text-fl-on-acc disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setForm(null)} className="h-12 rounded-xl bg-fl-s2 px-5 text-fl-tx2">Cancel</button>
          </div>
        </section>
      )}

      <input
        aria-label="Search exercises" placeholder="Search exercises (try RDL, lat pulldown, incline chest)"
        value={q} onChange={e => setQ(e.target.value)} className={`${field} mb-3`}
      />
      <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {tabBtn('all', 'All')}{tabBtn('favorites', 'Favorites')}{tabBtn('recent', 'Recent')}{tabBtn('mine', 'Mine')}
      </div>
      <ExerciseFilters muscle={muscle} equip={equip} onMuscle={setMuscle} onEquip={setEquip} />

      {note && <p role="status" className="mb-3 text-sm text-fl-ok">{note}</p>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-fl-s2 p-3 text-sm text-fl-bad">{error}</p>}

      <ul className="space-y-2">
        {items.map(ex => {
          const open = openId === ex.id;
          return (
            <li key={ex.id} className={`${card} ${ex.archived_at ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <button className="min-w-0 flex-1 text-left" aria-expanded={open} onClick={() => setOpenId(open ? '' : ex.id)}>
                  <div className="truncate text-base font-semibold">{ex.name}{ex.is_custom ? <span className="ml-2 text-xs font-normal text-fl-tx2">yours</span> : null}{ex.archived_at ? <span className="ml-2 text-xs font-normal text-fl-tx2">archived</span> : null}</div>
                  <div className="truncate text-sm text-fl-tx2">{ex.muscle_group} · {ex.equipment}</div>
                </button>
                <button onClick={() => toggleFav(ex)} aria-pressed={favs.has(ex.id)} aria-label={favs.has(ex.id) ? `Remove ${ex.name} from favorites` : `Add ${ex.name} to favorites`}
                  className={`h-11 w-11 shrink-0 rounded-xl text-2xl ${favs.has(ex.id) ? 'text-yellow-300' : 'text-fl-tx2'}`}>{favs.has(ex.id) ? '★' : '☆'}</button>
              </div>
              {open && (
                <div className="mt-3 space-y-2 border-t border-fl-line pt-3 text-sm">
                  <div className="text-fl-tx2">Logged as: {TRACKING[ex.tracking_type] ?? ex.tracking_type}</div>
                  <div className="text-fl-tx2">Weight means: {LOAD[ex.load_convention] ?? ex.load_convention}</div>
                  {ex.instructions ? <p className="whitespace-pre-wrap text-fl-tx2">{ex.instructions}</p> : <p className="text-fl-tx2">No technique notes yet.</p>}
                  {ex.is_custom && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {ex.archived_at
                        ? <button onClick={() => setArchived(ex, false)} className="h-10 rounded-xl bg-fl-s2 px-4">Restore</button>
                        : <>
                            <button onClick={() => startNew(ex)} className="h-10 rounded-xl bg-fl-s2 px-4">Edit</button>
                            <button onClick={() => startNew(ex, true)} className="h-10 rounded-xl bg-fl-s2 px-4">Duplicate</button>
                            <button onClick={() => setArchived(ex, true)} className="h-10 rounded-xl bg-fl-s2 px-4">Archive</button>
                          </>}
                      <button onClick={() => deleteExercise(ex)} className="h-10 rounded-xl bg-fl-s2 px-4 text-fl-bad">Delete</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {loading && <p className="mt-4 text-center text-fl-tx2">Loading...</p>}
      {!loading && !error && items.length === 0 && (
        <div className={`${card} text-center`}>
          <p className="mb-3 text-fl-tx2">
            {tab === 'favorites' ? 'No favorites yet. Tap the star on any exercise.' : tab === 'recent' ? 'Nothing used yet. Exercises you add to a plan or log show up here.'
              : tab === 'mine' ? 'You have not created any exercises yet.' : 'No exercises match. Try fewer words or clear a filter.'}
          </p>
          {(tab === 'all' || tab === 'mine') && <button onClick={() => startNew()} className="h-11 rounded-xl bg-fl-acc px-4 font-bold text-fl-on-acc">Create {q.trim() ? `"${q.trim()}"` : 'an exercise'}</button>}
        </div>
      )}
      {hasMore && !loading && <button onClick={() => load(true, items.length)} className="mt-4 h-12 w-full rounded-xl bg-fl-s2 text-fl-tx2">Load more</button>}
      <p className="mt-6 text-center text-xs text-fl-tx2">Exercise information is general and not medical advice. <Link href="/plan" className="underline">Back to Plan</Link></p>
    </main>
  );
}
