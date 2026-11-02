// Design preview only. Illustrative mock data: nothing here reads or writes Supabase.
// One source of truth: every count, target, time and rotation label in the UI is derived from this.

export type Kind = 'weight' | 'bodyweight';
export type LibEx = {
  id: string; name: string; muscle: string; equip: string; kind: Kind; inc: number; startW: number;
  desc: string; custom?: boolean;
};
export type PlanEx = { id: string; exId: string; sets: number; min: number; max: number; rest: number; rir: boolean };
export type Day = { id: string; name: string; ex: PlanEx[] };
export type HistSet = { w: number; r: number };
export type Session = { daysAgo: number; sets: HistSet[] };
export type Hist = Record<string, Session[]>; // newest first

export const LIB: LibEx[] = [
  { id: 'bench', name: 'Barbell Bench Press', muscle: 'Chest', equip: 'Barbell', kind: 'weight', inc: 5, startW: 95, desc: 'Lie on a flat bench, lower the bar to mid chest, press back up.' },
  { id: 'incdb', name: 'Incline Dumbbell Press', muscle: 'Chest', equip: 'Dumbbell', kind: 'weight', inc: 5, startW: 40, desc: 'Press dumbbells on a 30 degree bench.' },
  { id: 'fly', name: 'Cable Chest Fly', muscle: 'Chest', equip: 'Cable', kind: 'weight', inc: 5, startW: 20, desc: 'Bring the handles together in a wide arc.' },
  { id: 'pushup', name: 'Push-Up', muscle: 'Chest', equip: 'Bodyweight', kind: 'bodyweight', inc: 0, startW: 0, desc: 'Hands under shoulders, body in one line, chest to floor.' },
  { id: 'dip', name: 'Chest Dip', muscle: 'Chest', equip: 'Bodyweight', kind: 'bodyweight', inc: 0, startW: 0, desc: 'Lean forward and lower until upper arms are parallel.' },
  { id: 'row', name: 'Barbell Row', muscle: 'Back', equip: 'Barbell', kind: 'weight', inc: 5, startW: 65, desc: 'Hinge forward, pull the bar to your lower ribs.' },
  { id: 'pulldown', name: 'Lat Pulldown', muscle: 'Back', equip: 'Cable', kind: 'weight', inc: 5, startW: 80, desc: 'Pull the bar to your upper chest, elbows down.' },
  { id: 'pullup', name: 'Pull-Up', muscle: 'Back', equip: 'Bodyweight', kind: 'bodyweight', inc: 0, startW: 0, desc: 'Hang from a bar, pull your chin over it.' },
  { id: 'cablerow', name: 'Seated Cable Row', muscle: 'Back', equip: 'Cable', kind: 'weight', inc: 5, startW: 70, desc: 'Row the handle to your belly, keep your chest tall.' },
  { id: 'dbrow', name: 'One-Arm Dumbbell Row', muscle: 'Back', equip: 'Dumbbell', kind: 'weight', inc: 5, startW: 40, desc: 'Brace on a bench and row the dumbbell to your hip.' },
  { id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', equip: 'Barbell', kind: 'weight', inc: 5, startW: 55, desc: 'Press the bar from your collarbone to overhead.' },
  { id: 'lateral', name: 'Dumbbell Lateral Raise', muscle: 'Shoulders', equip: 'Dumbbell', kind: 'weight', inc: 2.5, startW: 10, desc: 'Raise dumbbells out to the side to shoulder height.' },
  { id: 'facepull', name: 'Face Pull', muscle: 'Shoulders', equip: 'Cable', kind: 'weight', inc: 5, startW: 30, desc: 'Pull the rope to your face with elbows high.' },
  { id: 'curl', name: 'Dumbbell Curl', muscle: 'Biceps', equip: 'Dumbbell', kind: 'weight', inc: 2.5, startW: 20, desc: 'Curl without swinging your torso.' },
  { id: 'pushdown', name: 'Triceps Pushdown', muscle: 'Triceps', equip: 'Cable', kind: 'weight', inc: 5, startW: 40, desc: 'Keep elbows pinned and extend fully.' },
  { id: 'squat', name: 'Barbell Back Squat', muscle: 'Quads', equip: 'Barbell', kind: 'weight', inc: 5, startW: 95, desc: 'Squat to at least parallel and stand tall.' },
  { id: 'legpress', name: 'Leg Press', muscle: 'Quads', equip: 'Machine', kind: 'weight', inc: 10, startW: 180, desc: 'Lower with control and press without locking out hard.' },
  { id: 'legext', name: 'Leg Extension', muscle: 'Quads', equip: 'Machine', kind: 'weight', inc: 5, startW: 60, desc: 'Extend your knees and pause at the top.' },
  { id: 'lunge', name: 'Walking Lunge', muscle: 'Quads', equip: 'Dumbbell', kind: 'weight', inc: 5, startW: 20, desc: 'Take long steps and keep your torso upright.' },
  { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Hamstrings', equip: 'Barbell', kind: 'weight', inc: 5, startW: 95, desc: 'Push your hips back with a long spine and soft knees.' },
  { id: 'legcurl', name: 'Seated Leg Curl', muscle: 'Hamstrings', equip: 'Machine', kind: 'weight', inc: 5, startW: 50, desc: 'Curl heels toward you and control the return.' },
  { id: 'thrust', name: 'Barbell Hip Thrust', muscle: 'Glutes', equip: 'Barbell', kind: 'weight', inc: 10, startW: 95, desc: 'Drive your hips up with shoulders on a bench.' },
  { id: 'calf', name: 'Standing Calf Raise', muscle: 'Calves', equip: 'Machine', kind: 'weight', inc: 10, startW: 90, desc: 'Full stretch at the bottom, pause at the top.' },
  { id: 'plank', name: 'Cable Crunch', muscle: 'Abs', equip: 'Cable', kind: 'weight', inc: 5, startW: 50, desc: 'Curl your ribs toward your hips.' },
];

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'];
export const EQUIP = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'];

export const libOf = (all: LibEx[], id: string) => all.find((e) => e.id === id) ?? all[0];

const px = (id: string, exId: string, sets: number, min: number, max: number, rest = 120): PlanEx => ({ id, exId, sets, min, max, rest, rir: false });

export const SEED_PLAN: Day[] = [
  { id: 'ua', name: 'Upper A', ex: [px('ua1', 'bench', 3, 6, 10), px('ua2', 'row', 3, 8, 12), px('ua3', 'ohp', 3, 6, 10), px('ua4', 'pulldown', 3, 8, 12, 90), px('ua5', 'pullup', 3, 5, 12, 90)] },
  { id: 'la', name: 'Lower A', ex: [px('la1', 'squat', 3, 5, 8, 150), px('la2', 'rdl', 3, 8, 10), px('la3', 'legpress', 3, 10, 15), px('la4', 'calf', 3, 10, 15, 60)] },
  { id: 'ub', name: 'Upper B', ex: [px('ub1', 'incdb', 3, 8, 12), px('ub2', 'dbrow', 3, 8, 12), px('ub3', 'lateral', 3, 12, 15, 60), px('ub4', 'curl', 2, 8, 12, 60), px('ub5', 'pushdown', 2, 10, 15, 60)] },
  { id: 'lb', name: 'Lower B', ex: [px('lb1', 'thrust', 3, 8, 12), px('lb2', 'legext', 3, 10, 15, 90), px('lb3', 'legcurl', 3, 10, 15, 90), px('lb4', 'lunge', 2, 10, 12)] },
];

const S = (daysAgo: number, ...sets: [number, number][]): Session => ({ daysAgo, sets: sets.map(([w, r]) => ({ w, r })) });

export const SEED_HIST: Hist = {
  // Edge: sets differ (8, 8, 7): hold weight, aim for the best set again.
  bench: [S(6, [135, 8], [135, 8], [135, 7]), S(13, [130, 8], [130, 7], [130, 6]), S(20, [125, 9], [125, 8], [125, 8])],
  // Edge: every set at the top of the range: weight goes up.
  row: [S(6, [115, 12], [115, 12], [115, 12]), S(13, [110, 12], [110, 11], [110, 10])],
  // Edge: one set below the minimum: hold weight and rebuild.
  ohp: [S(6, [75, 7], [75, 6], [75, 5]), S(13, [75, 6], [75, 6], [75, 5])],
  // Edge: bodyweight, reps only.
  pullup: [S(6, [0, 8], [0, 7], [0, 6]), S(13, [0, 7], [0, 6], [0, 5])],
  // Edge: no history for pulldown (first time).
  squat: [S(4, [155, 6], [155, 6], [155, 5])],
  rdl: [S(4, [135, 10], [135, 10], [135, 9])],
  legpress: [S(4, [270, 12], [270, 11], [270, 10])],
  calf: [S(4, [140, 15], [140, 15], [140, 14])],
  incdb: [S(2, [50, 10], [50, 9], [50, 8])],
  dbrow: [S(2, [55, 12], [55, 11], [55, 10])],
  lateral: [S(2, [15, 15], [15, 14], [15, 12])],
  curl: [S(2, [25, 10], [25, 9])],
  pushdown: [S(2, [55, 12], [55, 12])],
  thrust: [S(1, [185, 10], [185, 10], [185, 9])],
  legext: [S(1, [100, 12], [100, 12], [100, 11])],
  legcurl: [S(1, [80, 12], [80, 11], [80, 10])],
  lunge: [S(1, [30, 10], [30, 10])],
};

export type Target = {
  w: number; r: number; kind: 'first' | 'up' | 'hold' | 'rebuild' | 'bw';
  headline: string; // one short line
  detail: string[]; // expandable
  lastLine: string; // "135 x 8, 8, 7"
  delta?: number; // lb added
};

export const fmtW = (w: number) => (Number.isInteger(w) ? String(w) : w.toFixed(1));

export function lastLine(sessions: Session[] | undefined, kind: Kind): string {
  const s = sessions?.[0];
  if (!s) return 'No history yet';
  if (kind === 'bodyweight') return s.sets.map((x) => x.r).join(', ') + ' reps';
  const same = s.sets.every((x) => x.w === s.sets[0].w);
  return same ? `${fmtW(s.sets[0].w)} x ${s.sets.map((x) => x.r).join(', ')}` : s.sets.map((x) => `${fmtW(x.w)}x${x.r}`).join(', ');
}

// Double progression. The headline, the numbers and the expandable detail all come from this one function.
export function computeTarget(pe: PlanEx, ex: LibEx, sessions: Session[] | undefined): Target {
  const last = sessions?.[0];
  const ll = lastLine(sessions, ex.kind);
  if (!last) {
    return {
      w: ex.startW, r: pe.min, kind: 'first', lastLine: ll,
      headline: ex.kind === 'bodyweight' ? `Start with ${pe.min} clean reps` : `Suggested start: ${fmtW(ex.startW)} lb x ${pe.min}`,
      detail: [
        'This is your first time logging this exercise, so there is nothing to build on yet.',
        ex.kind === 'bodyweight' ? 'Do as many clean reps as you can per set.' : `Pick a weight you could lift for about ${pe.min + 4} reps. ${fmtW(ex.startW)} lb is only a starting guess.`,
        'After this session, your target is calculated from what you actually lift.',
      ],
    };
  }
  const reps = last.sets.map((s) => s.r);
  const best = Math.max(...reps);
  const worst = Math.min(...reps);
  const w = last.sets[0].w;
  const listed = reps.join(', ');
  if (ex.kind === 'bodyweight') {
    const r = Math.min(pe.max, best + 1);
    return {
      w: 0, r, kind: 'bw', lastLine: ll,
      headline: `Aim for ${r} reps on your first set`,
      detail: [`Last session you did ${listed} reps.`, `Beat your best set by one rep (${best} to ${r}) and keep the other sets close.`, `At ${pe.max} reps on every set, add weight with a belt or vest.`],
    };
  }
  if (reps.every((x) => x >= pe.max)) {
    const nw = w + ex.inc;
    return {
      w: nw, r: pe.min, kind: 'up', delta: ex.inc, lastLine: ll,
      headline: `Weight goes up ${fmtW(ex.inc)} lb`,
      detail: [`Last session every set reached ${pe.max} reps at ${fmtW(w)} lb (${listed}).`, `That is the top of your ${pe.min}-${pe.max} range, so the weight goes up ${fmtW(ex.inc)} lb and reps reset to ${pe.min}.`, 'If it feels too heavy, lower the target. Your history is kept either way.'],
    };
  }
  if (worst < pe.min) {
    return {
      w, r: pe.min, kind: 'rebuild', lastLine: ll,
      headline: `Hold ${fmtW(w)} lb and rebuild to ${pe.min}`,
      detail: [`Last session you did ${listed} at ${fmtW(w)} lb. One set fell below ${pe.min} reps.`, `Keep the weight and get every set to ${pe.min} or more before adding weight.`, `Weight goes up once every set reaches ${pe.max}.`],
    };
  }
  const r = Math.min(pe.max, Math.max(pe.min, best));
  return {
    w, r, kind: 'hold', lastLine: ll,
    headline: `Keep ${fmtW(w)} lb, aim for ${r} on every set`,
    detail: [`Last session you did ${listed} at ${fmtW(w)} lb.`, `Keep the weight and aim for ${r} on every set.`, `Once every set reaches ${pe.max} reps, the next target goes up ${fmtW(ex.inc)} lb.`],
  };
}

export const estMinutes = (ex: PlanEx[]) => {
  const sec = ex.reduce((a, e) => a + e.sets * (e.rest + 45), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
};
export const totalSets = (ex: PlanEx[]) => ex.reduce((a, e) => a + e.sets, 0);

export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// Onboarding plan generator (mock): templates keyed by days per week.
export function generatePlan(days: number, minutes: number): Day[] {
  const t = (ids: [string, number, number, number][]): PlanEx[] => ids.map(([exId, sets, min, max], i) => px(`g${exId}${i}`, exId, sets, min, max, minutes <= 45 ? 90 : 120));
  const trim = (d: PlanEx[]) => (minutes <= 45 ? d.slice(0, 4) : d);
  const full = (n: string, a: [string, number, number, number][]): Day => ({ id: n.toLowerCase().replace(/\W/g, ''), name: n, ex: trim(t(a)) });
  const UA = full('Upper A', [['bench', 3, 6, 10], ['row', 3, 8, 12], ['ohp', 3, 6, 10], ['pulldown', 3, 8, 12], ['curl', 2, 8, 12]]);
  const LA = full('Lower A', [['squat', 3, 5, 8], ['rdl', 3, 8, 10], ['legpress', 3, 10, 15], ['calf', 3, 10, 15]]);
  const UB = full('Upper B', [['incdb', 3, 8, 12], ['dbrow', 3, 8, 12], ['lateral', 3, 12, 15], ['pushdown', 2, 10, 15], ['facepull', 2, 12, 15]]);
  const LB = full('Lower B', [['thrust', 3, 8, 12], ['legext', 3, 10, 15], ['legcurl', 3, 10, 15], ['lunge', 2, 10, 12]]);
  const PUSH = full('Push', [['bench', 3, 6, 10], ['ohp', 3, 6, 10], ['incdb', 3, 8, 12], ['lateral', 3, 12, 15], ['pushdown', 3, 10, 15]]);
  const PULL = full('Pull', [['row', 3, 8, 12], ['pulldown', 3, 8, 12], ['cablerow', 3, 8, 12], ['facepull', 2, 12, 15], ['curl', 3, 8, 12]]);
  const LEGS = full('Legs', [['squat', 3, 5, 8], ['rdl', 3, 8, 10], ['legpress', 3, 10, 15], ['legcurl', 3, 10, 15], ['calf', 3, 10, 15]]);
  const FB = (n: string, a: [string, number, number, number][]) => full(n, a);
  if (days <= 2) return [FB('Full Body A', [['squat', 3, 5, 8], ['bench', 3, 6, 10], ['row', 3, 8, 12], ['ohp', 2, 8, 12]]), FB('Full Body B', [['rdl', 3, 8, 10], ['incdb', 3, 8, 12], ['pulldown', 3, 8, 12], ['lateral', 2, 12, 15]])];
  if (days === 3) return [FB('Full Body A', [['squat', 3, 5, 8], ['bench', 3, 6, 10], ['row', 3, 8, 12], ['curl', 2, 8, 12]]), FB('Full Body B', [['rdl', 3, 8, 10], ['ohp', 3, 6, 10], ['pulldown', 3, 8, 12], ['pushdown', 2, 10, 15]]), FB('Full Body C', [['legpress', 3, 10, 15], ['incdb', 3, 8, 12], ['cablerow', 3, 8, 12], ['lateral', 2, 12, 15]])];
  if (days === 4) return [UA, LA, UB, LB];
  if (days === 5) return [UA, LA, PUSH, PULL, LEGS];
  return [PUSH, PULL, LEGS, { ...PUSH, id: 'push2', name: 'Push 2' }, { ...PULL, id: 'pull2', name: 'Pull 2' }, { ...LEGS, id: 'legs2', name: 'Legs 2' }];
}
