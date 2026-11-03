// Best-effort behavior log (table user_events, append-only, owned by the user). Failures are swallowed on purpose:
// logging an event must never block logging a workout or editing a plan.
import { supabase } from './supabase';
import type { EventRow } from './swapSuggestions';

export async function logEvent(kind: 'swap' | 'skip' | 'feel' | 'suggestion', payload: Record<string, unknown>): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from('user_events').insert([{ user_id: data.user.id, kind, payload }]);
  } catch { /* optional */ }
}

export async function loadEvents(days = 60): Promise<EventRow[]> {
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase.from('user_events').select('kind, payload, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500);
    return (data ?? []) as EventRow[];
  } catch { return []; }
}
