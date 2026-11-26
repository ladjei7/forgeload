// Which past sessions the engine can compare with today's prescription.
import { RULES } from '../rules.ts';
import { readWorking, doneSets } from './sets.ts';
import type { PastSession, Prescription } from './types.ts';

/** Sessions that can feed a target: not a deload, at least one set done. Newest first, limited to the window. */
export function eligible(sessions: PastSession[], window: number = RULES.progression.historyWindow): PastSession[] {
  return [...sessions]
    .filter(s => !s.isDeload && doneSets(s.sets).length > 0)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, window);
}

/**
 * Was the session done against a comparable prescription? Ranges that overlap are comparable (8-10 and
 * 8-12); ranges that don't are a different goal (8-10 and 3-5) and their numbers don't carry over.
 * Old rows without a stored prescription are assumed comparable.
 */
export function comparable(s: PastSession, rx: Prescription): boolean {
  const p = s.prescription;
  if (!p || !p.repMin || !p.repMax) return true;
  return p.repMin <= rx.repMax && rx.repMin <= p.repMax;
}

/**
 * How many of the most recent comparable sessions in a row were at `weight` with the weakest working set
 * under the bottom of the range. Stops at the first session that doesn't match.
 */
export function sessionsBelowMin(newestFirst: PastSession[], rx: Prescription, weight: number): number {
  let n = 0;
  for (const s of newestFirst) {
    if (!comparable(s, rx)) break;
    const r = readWorking(s.sets);
    if (r.kind !== 'ok' || r.weight !== weight || Math.min(...r.reps) >= rx.repMin) break;
    n++;
  }
  return n;
}
