// Rule-based plan generator. Pure and deterministic: same answers in, same plan out.
// It only chooses from the curated library (data.ts PICK / PATTERN / levelOf). No scoring model, no randomness.
import { LIB, PICK, PATTERN, estMinutes, levelOf, comfortLevel, type Comfort, type Day, type LibEx, type Pattern, type PlanEx } from './data.ts';

export type GenInput = { days: number; exp: string; goal: string; time: number; comfort: Comfort; avoid?: string[] };
export type GenResult = { days: Day[]; why: Record<string, string>; coverage: Record<string, number>; notes: string[] };

type Slot = { p: Pattern; pr: number }; // pr: lower = more important, dropped last
const s = (p: Pattern, pr: number): Slot => ({ p, pr });

const FB_A: Slot[] = [s('squat', 1), s('hpush', 2), s('hpull', 3), s('hinge', 4), s('vpull', 5), s('vpush', 6), s('lateral', 7), s('core', 8)];
const FB_B: Slot[] = [s('hpull', 1), s('vpush', 2), s('squat', 3), s('vpull', 4), s('hpush', 5), s('hinge', 6), s('biceps', 7), s('calf', 8)];
const FB_C: Slot[] = [s('hinge', 1), s('hpush', 2), s('vpull', 3), s('squat', 4), s('hpull', 5), s('vpush', 6), s('triceps', 7), s('core', 8)];
const UP_A: Slot[] = [s('hpush', 1), s('hpull', 2), s('vpush', 3), s('vpull', 4), s('triceps', 5), s('biceps', 6), s('lateral', 7)];
const UP_B: Slot[] = [s('hpull', 1), s('hpush', 2), s('vpull', 3), s('vpush', 4), s('lateral', 5), s('biceps', 6), s('triceps', 7)];
const LO_A: Slot[] = [s('squat', 1), s('hinge', 2), s('kext', 3), s('calf', 4), s('core', 5)];
const LO_B: Slot[] = [s('hinge', 1), s('squat', 2), s('kflex', 3), s('calf', 4), s('core', 5)];
const PUSH: Slot[] = [s('hpush', 1), s('vpush', 2), s('hpush', 3), s('lateral', 4), s('triceps', 5)];
const PULL: Slot[] = [s('vpull', 1), s('hpull', 2), s('hpull', 3), s('reardelt', 4), s('biceps', 5)];
const LEGS: Slot[] = [s('squat', 1), s('hinge', 2), s('kext', 3), s('kflex', 4), s('calf', 5)];

const SPLITS: Record<number, { name: string; slots: Slot[] }[]> = {
  2: [{ name: 'Full body A', slots: FB_A }, { name: 'Full body B', slots: FB_B }],
  3: [{ name: 'Full body A', slots: FB_A }, { name: 'Full body B', slots: FB_B }, { name: 'Full body C', slots: FB_C }],
  4: [{ name: 'Upper A', slots: UP_A }, { name: 'Lower A', slots: LO_A }, { name: 'Upper B', slots: UP_B }, { name: 'Lower B', slots: LO_B }],
  5: [{ name: 'Upper', slots: UP_A }, { name: 'Lower', slots: LO_A }, { name: 'Push', slots: PUSH }, { name: 'Pull', slots: PULL }, { name: 'Legs', slots: LEGS }],
  6: [{ name: 'Push A', slots: PUSH }, { name: 'Pull A', slots: PULL }, { name: 'Legs A', slots: LEGS }, { name: 'Push B', slots: PUSH }, { name: 'Pull B', slots: PULL }, { name: 'Legs B', slots: LEGS }],
};

export const MAJOR: Pattern[] = ['hpush', 'vpush', 'hpull', 'vpull', 'squat', 'hinge'];
export const MAJOR_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings'];
const MAIN = new Set<Pattern>(['hpush', 'vpush', 'hpull', 'vpull', 'squat', 'hinge']);
const ADVANCED = new Set(['pullup', 'dip']); // bodyweight lifts that need strength and technique: never used as a fallback
export const PATTERN_LABEL: Record<Pattern, string> = {
  hpush: 'chest press', vpush: 'shoulder press', hpull: 'rows', vpull: 'pulldowns', squat: 'squats and leg press', hinge: 'hip hinge', kext: 'quads', kflex: 'hamstring curl',
  calf: 'calves', lateral: 'side shoulders', reardelt: 'rear shoulders', biceps: 'biceps', triceps: 'triceps', core: 'core', fly: 'chest fly', other: 'other',
};
const WHAT: Record<Pattern, string> = {
  hpush: 'Pushes forward: chest, front shoulders and triceps.', vpush: 'Pushes overhead: shoulders and triceps.', hpull: 'Pulls toward you: upper back and biceps.',
  vpull: 'Pulls down: lats and biceps.', squat: 'Works quads and glutes.', hinge: 'Works hamstrings, glutes and lower back.', kext: 'Isolates the quads.',
  kflex: 'Isolates the hamstrings.', calf: 'Builds the calves.', lateral: 'Builds the sides of the shoulders.', reardelt: 'Strengthens rear shoulders and upper back, which helps posture.',
  biceps: 'Isolates the biceps.', triceps: 'Isolates the triceps.', core: 'Trains the abs.', fly: 'Stretches and squeezes the chest.', other: '',
};

export function candidates(p: Pattern, level: 1 | 2 | 3, avoid: Set<string>): string[] {
  const table = PICK[p]; const out: string[] = [];
  if (table) for (const l of [level, 3, 2, 1] as const) { if (l > level) continue; for (const id of table[l]) if (!out.includes(id)) out.push(id); }
  // Library fallback (only if every curated choice is avoided): same pattern, within the user's level, never an advanced bodyweight lift.
  const lib = LIB.filter((e) => PATTERN[e.id] === p && levelOf(e) <= level && !ADVANCED.has(e.id)).map((e) => e.id);
  for (const id of lib) if (!out.includes(id)) out.push(id);
  return out.filter((id) => !avoid.has(id));
}

function reps(p: Pattern, goal: string): [number, number] {
  if (!MAIN.has(p)) return p === 'lateral' ? [12, 15] : [10, 15];
  if (goal === 'strength') return p === 'hinge' ? [5, 8] : p === 'vpull' ? [6, 10] : [4, 6];
  if (goal === 'muscle') return [8, 12];
  return p === 'hinge' || p === 'vpull' ? [8, 12] : [6, 10];
}
function restOf(p: Pattern, goal: string): number {
  if (MAIN.has(p)) return goal === 'strength' && (p === 'squat' || p === 'hpush' || p === 'hinge') ? 150 : p === 'vpull' || p === 'hpull' ? 90 : 120;
  return p === 'kext' || p === 'kflex' ? 90 : 60;
}

function how(ex: LibEx, comfort: Comfort): string {
  const l = levelOf(ex); const eq = ex.equip === 'Bodyweight' ? 'bodyweight' : ex.equip.toLowerCase();
  if (l === 1) return comfort === 'machines' ? 'You said you prefer guided movements, so this one runs on a fixed path.' : comfort === 'all' ? `A ${eq} keeps tension steady on this one.` : 'A machine or cable is simple to learn and easy to adjust.';
  if (l === 2) return comfort === 'mixed' ? 'Dumbbells fit your mix of machines and dumbbells.' : comfort === 'unsure' ? 'Dumbbells are an easy place to start. You can swap to a machine any time.' : 'Dumbbells let each side work on its own.';
  return 'You said you are comfortable with barbells, so this uses the classic barbell version.';
}

export function generatePlan(inp: GenInput): GenResult {
  const level = comfortLevel(inp.comfort); const avoid = new Set(inp.avoid ?? []);
  const split = SPLITS[Math.min(6, Math.max(2, inp.days))];
  const occ: Partial<Record<Pattern, number>> = {}; // how many times a pattern has been placed so far: later days get the next variation
  const why: Record<string, string> = {}; const said = new Set<string>(); const empty = new Set<Pattern>(); const dropped = new Set<Pattern>(); const days: Day[] = [];
  split.forEach((tpl, di) => {
    const used = new Set<string>(); let ex: { slot: Slot; pe: PlanEx }[] = [];
    for (const slot of tpl.slots) {
      const list = candidates(slot.p, level, avoid); const n = occ[slot.p] ?? 0;
      const id = list.length ? [...list.slice(n % list.length), ...list.slice(0, n % list.length)].find((x) => !used.has(x)) : undefined;
      if (!id) { empty.add(slot.p); continue; } // nothing suitable and allowed: leave the slot empty rather than break a rule
      used.add(id); occ[slot.p] = n + 1;
      const [min, max] = reps(slot.p, inp.goal); const main = MAIN.has(slot.p);
      const sets = main ? (inp.exp === 'exp' && slot.pr <= 2 ? 4 : 3) : 2;
      const peId = `g${di + 1}e${ex.length + 1}`;
      ex.push({ slot, pe: { id: peId, exId: id, sets, min, max, rest: restOf(slot.p, inp.goal), rir: false } });
    }
    // Time fit: drop the least important slots first, never below three exercises.
    while (ex.length > 3 && (estMinutes(ex.map((x) => x.pe)) > inp.time || ex.length > 8)) {
      let k = 0; ex.forEach((x, i) => { if (x.slot.pr >= ex[k].slot.pr) k = i; });
      dropped.add(ex[k].slot.p); ex = ex.filter((_, i) => i !== k);
    }
    ex.forEach((x, i) => { x.pe.id = `g${di + 1}e${i + 1}`; });
    // The first exercise of each pattern got a lower-priority sibling dropped; rebuild reasons after final ids.
    for (const x of ex) { const e = LIB.find((l) => l.id === x.pe.exId)!; const h = how(e, inp.comfort); const first = !said.has(h); said.add(h); why[x.pe.id] = first ? `${WHAT[x.slot.p]} ${h}` : WHAT[x.slot.p]; }
    days.push({ id: `g${di + 1}`, name: tpl.name, ex: ex.map((x) => x.pe) });
  });
  const coverage: Record<string, number> = {};
  for (const d of days) for (const e of d.ex) { const m = LIB.find((l) => l.id === e.exId)!.muscle; coverage[m] = (coverage[m] ?? 0) + e.sets; }
  const notes: string[] = [];
  if (level < 3) notes.push('No barbell lifts to start. You can add any exercise later.');
  if (inp.comfort === 'unsure') notes.push('You were not sure, so we started with machines and dumbbells. Change this any time.');
  const left = [...dropped].filter((p) => !days.some((d) => d.ex.some((e) => PATTERN[e.exId] === p)));
  if (left.length) notes.push(`To keep workouts within ${inp.time} min we left out ${left.map((p) => PATTERN_LABEL[p]).join(', ')}.`);
  else if (dropped.size) notes.push(`To keep workouts within ${inp.time} min some small exercises were trimmed. Every main movement is still covered.`);
  const none = [...empty].filter((p) => MAJOR.includes(p) && !days.some((d) => d.ex.some((e) => PATTERN[e.exId] === p)));
  if (none.length) notes.push(`Nothing in your comfort range or outside your avoided list fits ${none.map((p) => PATTERN_LABEL[p]).join(', ')}, so it is left out. Tell us what you would like there.`);
  return { days, why, coverage, notes };
}
