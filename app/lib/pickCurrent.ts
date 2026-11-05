// Pure rule for which plan is "current". Plans are ordered oldest first.

export type PlanRow = { id: string; name: string; is_active?: boolean | null };
/** Pure: this device's choice if it is still active, else the newest active plan, else the newest plan. */
export function pickCurrent<T extends PlanRow>(plans: T[], stored: string | null): T | undefined {
  if (!plans.length) return undefined;
  const active = (p: T) => p.is_active !== false;
  return plans.find(p => p.id === stored && active(p)) ?? [...plans].reverse().find(active) ?? plans[plans.length - 1];
}

