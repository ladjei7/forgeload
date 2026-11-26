// Which sets of a past session count as the working sets for progression.
//
// Explicit set types win: warm-ups and drop sets never count; a set taken to failure is still a working
// set. Old sessions have no types (everything was saved as "working"), so the working weight is inferred
// conservatively: the weight used for the most sets, and only when that weight covers at least half the
// sets and was used at least twice (or the exercise had one weight). Otherwise the session is "unclear"
// and the engine says so instead of guessing. The original records are never changed.
import type { LoggedSet } from './types.ts';

export type WorkingRead =
  | { kind: 'ok'; weight: number; reps: number[]; notes: string[] }
  | { kind: 'unclear'; weights: number[]; notes: string[] }
  | { kind: 'none'; notes: string[] };

const EXCLUDED = new Set(['warmup', 'drop', 'top', 'backoff']);

/** Sets that were actually done (reps over 0, not skipped), in their logged order. */
export function doneSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter(s => !s.skipped && s.reps > 0 && s.weight >= 0);
}

export function readWorking(sets: LoggedSet[], unitLabel = 'lb'): WorkingRead {
  const done = doneSets(sets);
  const marked = done.filter(s => s.kind && EXCLUDED.has(String(s.kind)));
  const cand = done.filter(s => !(s.kind && EXCLUDED.has(String(s.kind))));
  const notes: string[] = [];
  if (marked.some(s => s.kind === 'warmup')) notes.push('Warm-up sets are not counted.');
  if (marked.some(s => s.kind === 'drop')) notes.push('Drop sets are not counted.');
  if (marked.some(s => s.kind === 'top' || s.kind === 'backoff')) notes.push('Top and back-off sets need their own method; they are not counted here.');
  if (!cand.length) return { kind: 'none', notes };

  const count = new Map<number, number>();
  for (const s of cand) count.set(s.weight, (count.get(s.weight) ?? 0) + 1);
  const weights = [...count.keys()];
  const most = Math.max(...count.values());
  // the weight with the most sets; on a tie, the one used later
  let w = cand[cand.length - 1].weight;
  for (let i = cand.length - 1; i >= 0; i--) if (count.get(cand[i].weight) === most) { w = cand[i].weight; break; }

  if (weights.length > 1 && (most < 2 || most * 2 < cand.length)) {
    const list = [...weights].sort((a, b) => a - b).join(', ');
    return { kind: 'unclear', weights, notes: [...notes, `Last time used several weights (${list} ${unitLabel}) without one main working weight.`] };
  }
  const first = cand.findIndex(s => s.weight === w);
  const heavier = cand.filter(s => s.weight > w);
  const lighterBefore = cand.slice(0, first).filter(s => s.weight < w);
  const lighterAfter = cand.slice(first).filter(s => s.weight < w);
  if (heavier.length) notes.push(`Your ${[...new Set(heavier.map(s => s.weight))].join(', ')} ${unitLabel} set${heavier.length > 1 ? 's were' : ' was'} heavier than your working weight and ${heavier.length > 1 ? 'are' : 'is'} not used for this target.`);
  if (lighterBefore.length) notes.push('Lighter sets before your working sets were treated as warm-ups.');
  if (lighterAfter.length) notes.push('Lighter sets after your working sets were treated as back-off sets and not counted.');
  return { kind: 'ok', weight: w, reps: cand.filter(s => s.weight === w).map(s => s.reps), notes };
}
