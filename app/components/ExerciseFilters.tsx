'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Facet = { kind: 'muscle' | 'equipment'; value: string; n: number };

let cache: Facet[] | null = null;

// Filter options come from the database (only what the signed-in user can see).
export function useFacets() {
  const [facets, setFacets] = useState<Facet[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    (async () => {
      const { data, error } = await supabase.rpc('exercise_facets');
      if (error || !data) return;
      cache = (data as Facet[]).map(f => ({ ...f, n: Number(f.n) }));
      setFacets(cache);
    })();
  }, []);
  const sorted = (kind: Facet['kind']) =>
    facets.filter(f => f.kind === kind).sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
  return { muscles: sorted('muscle'), equipment: sorted('equipment') };
}

export function clearFacetCache() { cache = null; }

const sel = (on: boolean) =>
  `h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-fl-acc/50 ${on ? 'border-fl-acc bg-fl-acc/10 text-fl-tx' : 'border-fl-line bg-fl-s2 text-fl-tx2'}`;

// Two compact dropdowns (scrollable lists) instead of rows of chips.
export default function ExerciseFilters({
  muscle, equip, onMuscle, onEquip,
}: {
  muscle: string; equip: string;
  onMuscle: (v: string) => void; onEquip: (v: string) => void;
}) {
  const { muscles, equipment } = useFacets();
  return (
    <div className="mb-3 flex gap-2">
      <select aria-label="Filter by muscle" value={muscle} onChange={e => onMuscle(e.target.value)} className={sel(!!muscle)}>
        <option value="">All muscles</option>
        {muscles.map(f => <option key={f.value} value={f.value}>{f.value} ({f.n})</option>)}
      </select>
      <select aria-label="Filter by equipment" value={equip} onChange={e => onEquip(e.target.value)} className={sel(!!equip)}>
        <option value="">All equipment</option>
        {equipment.map(f => <option key={f.value} value={f.value}>{f.value} ({f.n})</option>)}
      </select>
    </div>
  );
}
