import { supabase } from './supabase';

import { normalizeTier, type Tier } from './tierRules';
export type { Tier };

/**
 * Reads the effective tier from the server (my_tier(), migration 007). The client only uses this to draw the UI.
 * Premium analysis must also be checked server-side. Fails closed for Pro analysis; logging and history never call this.
 */
export async function getTier(): Promise<Tier> {
  try {
    const { data, error } = await supabase.rpc('my_tier');
    return error ? 'free' : normalizeTier(data);
  } catch { return 'free'; }
}
