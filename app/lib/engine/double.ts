// Double progression, version 2 (the default strategy).
//
// Earn reps first, then weight:
//   1. Hold the working weight. Keep every set at least where it was last time (capped at the top of the
//      range), and add one rep to the set that needs it most: the lowest, the earliest on a tie.
//   2. When every PLANNED set reached the top of the range at that weight, go up one step (the
//      exercise's own step) and start again at the bottom of the range.
//   3. Bodyweight or a timed hold at the top with nothing to add: make it harder (load or variation).
//      Assisted: at the top, use one step less assistance.
//   4. Under the bottom of the range several sessions in a row at the same weight: keep the target,
//      and offer a lighter option the person can take or ignore.
// When the history can't support a confident number, the engine says so ('review') instead of guessing.
import { RULES } from '../rules.ts';
import { readWorking } from './sets.ts';
import { comparable, eligible, sessionsBelowMin } from './history.ts';
import { loadableWeight, stepText, trim } from './loading.ts';
import { restFor } from './rest.ts';
import type { ExerciseProfile, PastSession, Prescription, ProgressionStrategy, Recommendation } from './types.ts';

export const DOUBLE_VERSION = 'double-2';

/** Per-set targets while holding the weight. Exported for tests. */
export function holdTargets(prev: number[], rx: Prescription, add: number = RULES.progression.repsAddedPerSession, by = 1): number[] {
  const floor = prev.length ? Math.min(...prev) : rx.repMin;
  const t = Array.from({ length: rx.sets }, (_, i) => Math.min(rx.repMax, prev.at(i) ?? floor));
  for (let k = 0; k < add; k++) {
    let at = -1;
    for (let i = 0; i < t.length; i++) if (t.at(i)! < rx.repMax && (at === -1 || t.at(i)! < t.at(at)!)) at = i;
    if (at === -1) break;
    t.splice(at, 1, Math.min(rx.repMax, t.at(at)! + by));
  }
  return t;
}

const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
const list = (r: number[]) => r.join(', ');
const date = (iso: string) => { const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

export function recommendDouble(sessions: PastSession[], rx: Prescription, p: ExerciseProfile): Recommendation {
  const u = p.unit, w = (x: number) => `${trim(x)} ${u}`;
  const unitWord = p.measure === 'seconds' ? 's' : '';
  const reps = (r: number[]) => `${list(r)}${unitWord}`;
  const what = p.measure === 'seconds' ? 'seconds' : 'reps';
  const base = { strategy: 'double', version: DOUBLE_VERSION, measure: p.measure, restSeconds: restFor(p, rx) } as const;
  const history = eligible(sessions);
  const latest = history.at(0);

  if (!latest) {
    const first = p.load === 'external'
      ? `No history yet. Pick a weight you could do about ${rx.repMax + 2} times with good form, and stop at ${rx.repMax}.`
      : p.measure === 'seconds' ? `No history yet. Hold for ${rx.repMin}-${rx.repMax} seconds with good form.`
      : `No history yet. Aim for ${rx.repMin}-${rx.repMax} clean reps.`;
    const short = p.load === 'external' ? `First time: pick a weight you could do about ${rx.repMax + 2} times.` : p.measure === 'seconds' ? `First time: hold ${rx.repMin}-${rx.repMax}s with good form.` : `First time: aim for ${rx.repMin}-${rx.repMax} clean reps.`;
    return { ...base, action: 'start', weight: null, repsBySet: fill(rx.sets, rx.repMax), short, reason: first, details: ['After this workout, targets build on what you actually log.'], basedOn: null };
  }

  const when = date(latest.at);
  const basedOn = { at: latest.at, sessionIds: latest.id ? [latest.id] : [] };
  const read = readWorking(latest.sets, u);

  if (!comparable(latest, rx)) {
    const prx = latest.prescription!;
    return { ...base, action: 'review', weight: null, repsBySet: null, basedOn,
      short: `No reliable target: your range changed (${prx.repMin}-${prx.repMax} to ${rx.repMin}-${rx.repMax}).`,
      reason: `Your range changed from ${prx.repMin}-${prx.repMax} to ${rx.repMin}-${rx.repMax}, so last time's weight doesn't carry over. Pick today's weight.`,
      details: ['Targets start again from what you log today.'] };
  }
  if (read.kind !== 'ok') {
    return { ...base, action: 'review', weight: null, repsBySet: null, basedOn,
      short: read.kind === 'unclear' ? `No reliable target: last time mixed ${[...read.weights].sort((a, b) => a - b).join(', ')} ${u} with no main weight.` : 'No reliable target: no working sets last time.',
      reason: read.kind === 'unclear' ? 'Last time used several different weights. Pick today’s working weight.' : 'Last time had no working sets to build on. Pick today’s weight.',
      details: [...read.notes, 'Tip: mark warm-up sets as Warm-up so they are left out next time.'] };
  }

  const W = read.weight, done = read.reps;
  const planned = done.slice(0, rx.sets);
  const lastLine = `Last time${when ? ` (${when})` : ''}: ${W > 0 || p.load === 'external' ? `${w(W)} × ` : ''}${reps(done)}${p.perDumbbell && W > 0 ? (p.equipmentLabel === 'kettlebells' ? ' (per kettlebell)' : ' (per dumbbell)') : ''}.`;
  const details: string[] = [lastLine, ...read.notes];
  const allTop = done.length >= rx.sets && planned.every(r => r >= rx.repMax);

  if (allTop) {
    if (p.load === 'assisted') {
      const next = Math.max(0, loadableWeight(W - p.step, u));
      return { ...base, action: 'less_assistance', weight: next, repsBySet: fill(rx.sets, rx.repMin), basedOn,
        short: `Every set hit ${rx.repMax}: ${trim(W - next)} ${u} less assistance.`,
        reason: `You reached ${rx.repMax} on every set. Use ${w(next)} of assistance (${trim(p.step)} ${u} less) and aim for ${rx.repMin}+.`,
        details: [...details, `Less assistance means more of your own bodyweight. Step: ${stepText(p)}.`] };
    }
    if (p.load === 'bodyweight' && W === 0) {
      return { ...base, action: 'harder_variation', weight: null, repsBySet: fill(rx.sets, p.measure === 'seconds' ? rx.repMax : rx.repMin), basedOn,
        short: `Every set hit ${rx.repMax}${unitWord}: make it harder.`,
        reason: p.measure === 'seconds'
          ? `You held ${rx.repMax}s on every set. Make it harder: a harder variation or a little added weight.`
          : `You reached ${rx.repMax} on every set. Add a little weight or use a harder variation, then aim for ${rx.repMin}+.`,
        details };
    }
    const next = loadableWeight(W + p.step, u);
    const jump = W > 0 ? (next - W) / W : 0;
    return { ...base, action: 'add_weight', weight: next, repsBySet: fill(rx.sets, rx.repMin), basedOn,
      short: `Every set hit ${rx.repMax}${unitWord}: up ${trim(next - W)} ${u}${p.perDumbbell ? ' per dumbbell' : ''}.`,
      reason: `You reached ${rx.repMax}${unitWord} on every set at ${w(W)}. Go up to ${w(next)} and aim for ${rx.repMin}+ ${what}.`,
      details: [...details, `Step: ${stepText(p)}${p.stepSource === 'user' ? ' (your setting)' : ` (default for ${p.equipmentLabel}; you can change it)`}.`],
      ...(jump > RULES.progression.bigJumpRatio ? { caution: `That's a ${Math.round(jump * 100)}% jump. If you can't reach ${rx.repMin}, go back to ${w(W)} and add a rep there instead.`,
        cautionShort: `Big jump (${Math.round(jump * 100)}%): miss ${rx.repMin}? Go back to ${w(W)}.` } : {}) };
  }

  const t = holdTargets(done, rx, RULES.progression.repsAddedPerSession, p.measure === 'seconds' ? RULES.progression.secondsAddedPerSession : 1);
  const raised = t.map((x, i) => x > (done.at(i) ?? Math.min(...done)) ? i : -1).filter(i => i >= 0);
  const missing = rx.sets - done.length;
  const low = Math.min(...planned.length ? planned : done);
  const bw = W === 0 && p.load !== 'external';
  const stay = bw ? 'Keep going' : `Stay at ${w(W)}`;
  let reason: string;
  const by = p.measure === 'seconds' ? `${RULES.progression.secondsAddedPerSession}s` : '1 rep';
  const short = missing > 0 && !raised.length ? `Finish all ${rx.sets} sets${bw ? '' : ` at ${w(W)}`} first (${done.length} last time).`
    : low < rx.repMin ? `Below ${rx.repMin}${unitWord} last time: ${bw ? 'build it back up' : 'same weight, build it back up'}.`
    : raised.length === 1 ? `${bw ? '' : 'Same weight, '}+${by} on set ${raised[0] + 1}.`.replace(/^\+/, '+')
    : `${bw ? 'A' : 'Same weight, a'} little more on the weakest sets.`;
  if (missing > 0 && !raised.length) reason = bw ? `Do all ${rx.sets} sets before moving on. Last time you did ${done.length}.` : `Do all ${rx.sets} sets at ${w(W)} before going up. Last time ${done.length} ${done.length === 1 ? 'was' : 'were'} at ${w(W)}.`;
  else if (low < rx.repMin) reason = `Your lowest set was ${low}${unitWord}, under the ${rx.repMin} minimum. ${stay} and build it back up.`;
  else if (raised.length === 1) reason = `${stay} and aim for at least ${t.at(raised[0])}${unitWord} on set ${raised[0] + 1}. Keep the other sets at least where they were.`;
  else reason = `${stay} and add a little on your weakest sets.`;
  details.push('Targets are a minimum: do more if you can. Next time builds on what you actually log.');
  details.push(`Once every set reaches ${rx.repMax}${unitWord}, ${p.load === 'assisted' ? 'use less assistance' : W === 0 ? 'make it harder' : `go up to ${w(loadableWeight(W + p.step, u))}`}.`);

  let alternative: Recommendation['alternative'];
  let caution: string | undefined, cautionShort: string | undefined;
  const misses = sessionsBelowMin(history, rx, W);
  if (misses >= RULES.progression.belowMinSessions && W > 0) {
    const lighter = loadableWeight(p.load === 'assisted' ? W + p.step : W - p.step, u);
    if (lighter >= 0 && lighter !== W) {
      alternative = { weight: lighter, repsBySet: fill(rx.sets, rx.repMin), label: p.load === 'assisted' ? `Use ${w(lighter)} assistance` : `Use ${w(lighter)} today`,
        reason: `Under ${rx.repMin} at ${w(W)} in your last ${misses} workouts. Staying is fine if today feels better; ${p.load === 'assisted' ? 'a little more assistance' : `${trim(p.step)} ${u} lighter`} lets you rebuild your reps.` };
      caution = alternative.reason;
      cautionShort = `Under ${rx.repMin} at ${w(W)} for ${misses} workouts in a row.`;
    }
  } else if (misses === RULES.progression.belowMinSessions - 1 && W > 0) {
    details.push(`If you're under ${rx.repMin} again next time, Forgeload will offer a lighter option.`);
  }
  return { ...base, action: raised.length ? 'add_reps' : 'hold', weight: W === 0 && p.load !== 'external' ? 0 : W, repsBySet: t, basedOn, short, reason, details, caution, cautionShort, alternative };
}

export const doubleProgression: ProgressionStrategy = {
  id: 'double', version: DOUBLE_VERSION,
  recommend: ({ sessions, rx, profile }) => recommendDouble(sessions, rx, profile),
};
