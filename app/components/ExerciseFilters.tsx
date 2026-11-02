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

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-white bg-white text-black' : 'border-[#333] bg-[#1a1a1a] text-white'}`;

export default function ExerciseFilters({
  muscle, equip, onMuscle, onEquip,
}: {
  muscle: string; equip: string;
  onMuscle: (v: string) => void; onEquip: (v: string) => void;
}) {
  const { muscles, equipment } = useFacets();
  const row = 'flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]';
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-[#777]">Muscle</div>
      <div className={row} role="group" aria-label="Filter by muscle">
        {muscles.map(f => (
          <button key={f.value} type="button" aria-pressed={muscle === f.value}
            onMouseDown={e => e.preventDefault()} onClick={() => onMuscle(muscle === f.value ? '' : f.value)} className={chip(muscle === f.value)}>
            {f.value}
          </button>
        ))}
      </div>
      <div className="mb-1 mt-1 text-[11px] uppercase tracking-wide text-[#777]">Equipment</div>
      <div className={row} role="group" aria-label="Filter by equipment">
        {equipment.map(f => (
          <button key={f.value} type="button" aria-pressed={equip === f.value}
            onMouseDown={e => e.preventDefault()} onClick={() => onEquip(equip === f.value ? '' : f.value)} className={chip(equip === f.value)}>
            {f.value}
          </button>
        ))}
      </div>
    </div>
  );
}
