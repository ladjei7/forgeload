import { supabase } from './supabase';
import type { PlanTemplate } from './templates';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Creates a plan from a template. Each template exercise is linked to a library exercise by id:
// exact name first; otherwise the shortest result containing every word; otherwise the template's
// own name with no link. Nothing is guessed.
// `current: false` adds the plan without making it the current one (see currentPlan.ts).
export async function createPlanFromTemplate(tpl: PlanTemplate, opts: { current?: boolean } = {}): Promise<{ planId: string } | { error: string }> {
  const wanted = [...new Set(tpl.days.flatMap(d => d.exercises.map(e => e[0])))];
  const found: Record<string, { id: string; name: string } | null> = {};
  await Promise.all(wanted.map(async w => {
    const { data } = await supabase.rpc('search_exercises', { q: w, lim: 10 });
    const rows = (data ?? []) as { id: string; name: string }[];
    const exact = rows.find(r => norm(r.name) === norm(w));
    if (exact) { found[w] = exact; return; }
    const tokens = norm(w).split(' ');
    const hits = rows.filter(r => { const x = norm(r.name); return tokens.every(t => x.includes(t)); });
    hits.sort((a, b) => a.name.length - b.name.length);
    found[w] = hits[0] ?? null;
  }));
  const resolve = (want: string) => ({ name: found[want]?.name ?? want, id: found[want]?.id ?? null });
  const { data: plan, error: pErr } = await supabase.from('workout_plans').insert([{ name: tpl.name, is_active: opts.current ?? true }]).select().single();
  if (pErr || !plan) return { error: pErr?.message ?? 'could not create plan' };
  const { data: newDays, error: dErr } = await supabase.from('workout_days')
    .insert(tpl.days.map((d, i) => ({ plan_id: plan.id, day_name: d.name, sort_order: i }))).select('id, sort_order');
  if (dErr || !newDays) return { error: dErr?.message ?? 'could not create days' };
  const rows = newDays.flatMap(nd => tpl.days[nd.sort_order].exercises.map(([name, s, mn, mx], j) => ({
    workout_day_id: nd.id, exercise_name: resolve(name).name, exercise_id: resolve(name).id, target_sets: s, rep_min: mn, rep_max: mx, sort_order: j,
  })));
  const { error: eErr } = await supabase.from('plan_exercises').insert(rows);
  if (eErr) return { error: eErr.message };
  return { planId: plan.id as string };
}
