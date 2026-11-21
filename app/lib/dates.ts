// Dates in the user's LOCAL time zone. Using toISOString() gives the UTC date,
// which is "tomorrow" for a US user logging in the evening.

export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 'YYYY-MM-DD' from the database -> a Date at local midnight (new Date('YYYY-MM-DD') would be UTC).
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Local calendar date and time of a timestamp (what the person saw), not UTC. */
export function localParts(iso: string | null | undefined, fallbackDate?: string | null): [string, string] {
  if (!iso) return [fallbackDate ?? '', ''];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [fallbackDate ?? '', ''];
  return [`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, `${pad2(d.getHours())}:${pad2(d.getMinutes())}`];
}

