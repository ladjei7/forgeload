import { supabase } from './supabase';

// Columns added by migration 014. Until that migration is applied, saving retries without them,
// so nothing breaks (the plan itself is already built from the answers either way).
const V2 = ['pain_areas', 'focus', 'unit'] as const;

export type PrefsPatch = {
  comfort?: string; session_minutes?: number | null; ask_effort?: boolean; track_rir?: boolean;
  pain_areas?: string[]; focus?: string[]; unit?: 'lb' | 'kg';
};

export async function savePrefs(patch: PrefsPatch): Promise<{ error: { message: string } | null; partial: boolean }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: { message: 'Not signed in' }, partial: false };
  const row = { user_id: u.user.id, ...patch, updated_at: new Date().toISOString() };
  const first = await supabase.from('user_training_prefs').upsert(row);
  if (!first.error) return { error: null, partial: false };
  if (!/column|schema cache/i.test(first.error.message)) return { error: first.error, partial: false };
  const rest = Object.fromEntries(Object.entries(row).filter(([k]) => !(V2 as readonly string[]).includes(k)));
  if (Object.keys(rest).length <= 2) return { error: null, partial: true }; // only user_id and updated_at left
  const second = await supabase.from('user_training_prefs').upsert(rest);
  return { error: second.error, partial: true };
}
