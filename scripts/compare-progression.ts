// Old (suggestTarget) versus new (engine double-2) targets on realistic logs. Run: node scripts/compare-progression.ts
import { recommend, buildProfile, headline } from '../app/lib/engine/index.ts';
import { suggestTarget, latestForTarget } from '../app/lib/progression.ts';
type S = [number, number, string?];
let d = 1;
const sess = (sets: S[], extra = {}) => ({ at: `2026-11-${String(d++).padStart(2, '0')}T18:00:00Z`, sets: sets.map(([weight, reps, kind]) => ({ weight, reps, kind: kind ?? null })), ...extra });
const P = (meta: object, settings?: object) => buildProfile(meta as never, 'lb', settings as never);
const rows: [string, string, ReturnType<typeof sess>[], { sets: number; repMin: number; repMax: number }, ReturnType<typeof P>][] = [
  ['Barbell Bench Press', '3×6-8', [sess([[185, 7], [185, 6], [185, 6]])], { sets: 3, repMin: 6, repMax: 8 }, P({ equipment: 'Barbell', mechanic: 'compound' })],
  ['Barbell Back Squat', '3×6-8', [sess([[185, 8], [185, 8], [185, 8]])], { sets: 3, repMin: 6, repMax: 8 }, P({ equipment: 'Barbell', mechanic: 'compound' })],
  ['Incline Dumbbell Press', '3×8-10', [sess([[70, 10], [70, 9], [70, 8]])], { sets: 3, repMin: 8, repMax: 10 }, P({ equipment: 'Dumbbell', mechanic: 'compound' })],
  ['Dumbbell Lateral Raise', '3×12-15', [sess([[15, 15], [15, 15], [15, 15]])], { sets: 3, repMin: 12, repMax: 15 }, P({ equipment: 'Dumbbell', mechanic: 'isolation' })],
  ['Leg Press', '3×10-12', [sess([[270, 12], [270, 12], [270, 12]])], { sets: 3, repMin: 10, repMax: 12 }, P({ equipment: 'Machine', mechanic: 'compound' })],
  ['Cable Curl (5 lb stack setting)', '3×10-12', [sess([[40, 12], [40, 12], [40, 11]])], { sets: 3, repMin: 10, repMax: 12 }, P({ equipment: 'Cable', mechanic: 'isolation' }, { weightStepLb: 5 })],
  ['Weighted Pull-Up (+25 lb)', '3×6-8', [sess([[25, 8], [25, 8], [25, 8]])], { sets: 3, repMin: 6, repMax: 8 }, P({ equipment: 'Bodyweight', tracking: 'bodyweight_reps', mechanic: 'compound' })],
  ['Top set + back-offs', '3×6-8', [sess([[225, 6], [205, 8], [205, 8]])], { sets: 3, repMin: 6, repMax: 8 }, P({ equipment: 'Barbell', mechanic: 'compound' })],
  ['Squat, repeated misses', '3×6-8', [sess([[185, 8], [185, 8], [185, 8]]), sess([[190, 6], [190, 6], [190, 5]]), sess([[190, 6], [190, 6], [190, 5]]), sess([[190, 6], [190, 5], [190, 5]])], { sets: 3, repMin: 6, repMax: 8 }, P({ equipment: 'Barbell', mechanic: 'compound' })],
  ['Beginner, no history', '3×8-12', [], { sets: 3, repMin: 8, repMax: 12 }, P({ equipment: 'Machine', mechanic: 'compound' })],
  ['Pyramid (185/195/205)', '3×6-8', [sess([[185, 8], [195, 6], [205, 4]])], { sets: 3, repMin: 6, repMax: 8 }, P({ equipment: 'Barbell', mechanic: 'compound' })],
  ['Plank (seconds)', '3×30-60', [sess([[0, 45], [0, 40], [0, 35]])], { sets: 3, repMin: 30, repMax: 60 }, P({ equipment: 'Bodyweight', tracking: 'duration' })],
  ['Warm-ups marked, Romanian Deadlift', '3×8-10', [sess([[95, 10, 'warmup'], [135, 6, 'warmup'], [185, 10], [185, 10], [185, 9]])], { sets: 3, repMin: 8, repMax: 10 }, P({ equipment: 'Barbell', mechanic: 'compound' })],
  ['2 of 3 sets done, Lat Pulldown', '3×8-10', [sess([[120, 10], [120, 10]])], { sets: 3, repMin: 8, repMax: 10 }, P({ equipment: 'Cable', mechanic: 'compound' })],
];
const fmt = (sets: { weight: number; reps: number }[]) => { const ws = [...new Set(sets.map(s => s.weight))]; return ws.length === 1 ? `${ws[0]} × ${sets.map(s => s.reps).join(', ')}` : sets.map(s => `${s.weight}×${s.reps}`).join(', '); };
const out = rows.map(([name, rxs, h, rx, p]) => {
  const latest = latestForTarget(h.map(x => ({ at: x.at, sets: x.sets })));
  const prevSets = latest?.sets ?? [];
  const o = suggestTarget(prevSets.map(s => ({ weight: s.weight, reps: s.reps })), rx.repMin, rx.repMax, 5);
  const oldTxt = o.action === 'start' ? 'Find your starting weight' : `${o.weight === null ? 'add load' : o.weight === 0 ? 'Bodyweight' : `${o.weight} lb`} × ${o.reps} (every set)`;
  const n = recommend(h, rx, p);
  const newTxt = n.action === 'start' ? 'Find your starting weight' : headline(n, 'lb');
  return { name, rx: rxs, prev: h.length ? (h.length > 1 ? `${h.length} sessions; last: ${fmt(prevSets)}` : fmt(prevSets)) : 'none', old: oldTxt, new: newTxt, reason: n.reason, caution: n.caution ?? '', alt: n.alternative?.label ?? '' };
});
console.log(JSON.stringify(out, null, 1));
