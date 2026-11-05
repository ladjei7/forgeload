import { supabase } from './supabase';

// Which plan is "current". Saved two ways: on the account (workout_plans.is_active, so every device
// agrees) and on this device (fl-plan, so it still works offline). Plans are ordered oldest first.

import { pickCurrent, type PlanRow } from './pickCurrent';
export { pickCurrent, type PlanRow };
const KEY = 'fl-plan';

export function storedPlanId(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** Makes one plan current on this device and on the account. Never deletes or changes anything else. */
export async function setCurrentPlan(id: string): Promise<boolean> {
  try { localStorage.setItem(KEY, id); } catch { /* optional */ }
  const a = await supabase.from('workout_plans').update({ is_active: true }).eq('id', id);
  if (a.error) return false;
  const b = await supabase.from('workout_plans').update({ is_active: false }).neq('id', id);
  return !b.error;
}
