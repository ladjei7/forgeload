'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Ex = { id: string; name: string; muscle_group: string; equipment: string };

const ALIASES: Record<string, string> = {
  rdl: 'romanian deadlift', ohp: 'overhead press', sldl: 'stiff leg deadlift',
  db: 'dumbbell', bb: 'barbell', ez: 'ez bar', rear: 'rear delt',
  tri: 'tricep', bi: 'bicep', lat: 'lat', dl: 'deadlift', bp: 'bench press',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function expand(q: string) {
  return norm(q).split(' ').filter(Boolean).map(t => ALIASES[t] ?? t).join(' ');
}

export default function ExercisePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [all, setAll] = useState<Ex[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('exercises').select('id, name, muscle_group, equipment').order('name');
    if (data) setAll(data);
  }

  const tokens = expand(value).split(' ').filter(Boolean);
  const matches = tokens.length === 0 ? [] : all
    .filter(e => { const n = norm(e.name); return tokens.every(t => n.includes(t)); })
    .slice(0, 20);
  const exact = all.some(e => norm(e.name) === norm(value));

  async function addCustom() {
    const name = value.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from('exercises').insert([{ name, muscle_group: 'Other', equipment: 'Other', user_id: u.user.id }]);
    await load();
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <input
        type="text"
        placeholder="Search exercises (try bench, RDL, pendulum)"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
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
      {matches.map(e => (
        <div
          key={e.id}
          onMouseDown={() => { onChange(e.name); setOpen(false); }}
          style={{ padding: '0.75rem', borderBottom: '1px solid #222', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '15px' }}>{e.name}</div>
          <div style={{ fontSize: '12px', color: '#777' }}>{e.muscle_group} · {e.equipment}</div>
        </div>
      ))}
    </div>
    {!exact && (
      <div onMouseDown={addCustom} style={{ padding: '0.75rem', color: '#4ade80', cursor: 'pointer', fontSize: '14px', borderTop: '1px solid #333', background: '#111' }}>
        + Add "{value.trim()}" as a custom exercise
      </div>
    )}
  </div>
)}
    </div>
  );
}