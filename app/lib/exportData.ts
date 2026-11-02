import { supabase } from './supabase';

type Row = Record<string, unknown>;

// Reads every row the signed-in user can see (row-level security limits it to their own),
// in pages of 500 so large histories are not cut off.
async function all(table: string, select: string, order = 'created_at'): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < 500) break;
  }
  void order;
  return out;
}

const strip = (r: Row): Row => { const { user_id: _u, ...rest } = r; void _u; return rest; };

export type Export = {
  exported_at: string; app: string; note: string;
  plans: Row[]; sessions: Row[]; custom_exercises: Row[]; favorites_and_recents: Row[];
};

export async function buildExport(): Promise<Export> {
  const [plans, sessions, custom, prefs] = await Promise.all([
    all('workout_plans', '*, workout_days(*, plan_exercises(*))'),
    all('workout_sessions', '*, workout_days(day_name), exercise_logs(*, exercise_sets(*))'),
    all('exercises', '*').then(r => r.filter(x => x.user_id)),
    all('user_exercise_prefs', '*').catch(() => [] as Row[]),
  ]);
  const clean = (v: unknown): unknown => Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(strip(v as Row)).map(([k, x]) => [k, clean(x)])) : v;
  return {
    exported_at: new Date().toISOString(), app: 'Forgeload',
    note: 'Your own plans, workouts and custom exercises. Weights are in pounds. The built-in exercise library is not included.',
    plans: clean(plans) as Row[], sessions: clean(sessions) as Row[], custom_exercises: clean(custom) as Row[], favorites_and_recents: clean(prefs) as Row[],
  };
}

const q = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function setsCsv(x: Export): string {
  const lines = ['date,workout,exercise,set,weight_lb,reps'];
  for (const s of x.sessions) {
    const logs = (s.exercise_logs as Row[] | null) ?? [];
    const day = ((s.workout_days as Row | Row[] | null) && (Array.isArray(s.workout_days) ? (s.workout_days as Row[])[0] : s.workout_days as Row))?.day_name;
    for (const l of logs) for (const st of ((l.exercise_sets as Row[] | null) ?? []))
      lines.push([s.completed_at ?? s.session_date, day, l.exercise_name, st.set_number, st.weight, st.reps].map(q).join(','));
  }
  return lines.join('\n') + '\n';
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
