// Pounds or kilograms. Every weight is STORED in pounds (two decimals, so a kg entry round-trips
// exactly); the app converts only where people read or type a weight. Pure helpers, unit tested.

export type Unit = 'lb' | 'kg';
export const LB_PER_KG = 2.20462262;
const KEY = 'fl-unit';

/** Shown value in the person's unit. kg is rounded to 0.1 so 60 kg typed shows back as 60. */
export function show(lb: number, unit: Unit): number {
  if (unit === 'lb') return Math.round(lb * 100) / 100;
  return Math.round((lb / LB_PER_KG) * 10) / 10;
}
/** A typed value in the person's unit, converted to the stored pounds (2 decimals). */
export function toLb(value: number, unit: Unit): number {
  return unit === 'lb' ? value : Math.round(value * LB_PER_KG * 100) / 100;
}
/** Default weight step: 5 lb or 2.5 kg (the usual smallest jump with standard plates). */
export const stepFor = (unit: Unit) => (unit === 'kg' ? 2.5 : 5);
export const label = (unit: Unit) => (unit === 'kg' ? 'kg' : 'lb');
export const longName = (unit: Unit) => (unit === 'kg' ? 'kilograms' : 'pounds');
export const fmt = (lb: number, unit: Unit) => `${show(lb, unit)} ${label(unit)}`;

/** Suggested unit for a new person, from the device language (US and a few others use pounds). */
export function guessUnit(locale: string | undefined): Unit {
  return /^en-(US|LR)$|^my(-|$)/i.test(locale ?? '') ? 'lb' : 'kg';
}

/** This device's choice; existing accounts default to pounds (all data so far was entered in pounds). */
export function getUnit(): Unit {
  try { return localStorage.getItem(KEY) === 'kg' ? 'kg' : 'lb'; } catch { return 'lb'; }
}
export function setUnitLocal(u: Unit) { try { localStorage.setItem(KEY, u); } catch { /* optional */ } }

/**
 * A target you can actually put on the bar or pick off the rack. Kilograms: nearest 2.5 kg, and when
 * the target is to go up, always heavier than `above` (last time's top weight). Pounds: unchanged.
 */
export function loadable(w: number, unit: Unit, above?: number): number {
  if (unit === 'lb') return Math.round(w * 10) / 10;
  let r = Math.round(w / 2.5) * 2.5;
  if (above !== undefined && r <= above) r = Math.ceil((above + 0.01) / 2.5) * 2.5;
  return r;
}
