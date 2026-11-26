// Progression engine v2 (double-2). Numbers in test names refer to the scenario list in the
// progression brief (section 20). Weights are in the display unit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend, buildProfile, headline, readWorking, type PastSession, type Prescription } from '../app/lib/engine/index.ts';
import { holdTargets } from '../app/lib/engine/double.ts';
import { comparable, eligible, sessionsBelowMin } from '../app/lib/engine/history.ts';
import { restFor } from '../app/lib/engine/rest.ts';
import { loadableWeight, stepText } from '../app/lib/engine/loading.ts';
import { toSessions, exerciseKey } from '../app/lib/engine/fromDb.ts';
import { suggestTarget } from '../app/lib/progression.ts';

type S = [number, number] | [number, number, string];
let day = 1;
const sess = (sets: S[], extra: Partial<PastSession> = {}): PastSession =>
  ({ at: `2026-11-${String(day++).padStart(2, '0')}T18:00:00Z`, sets: sets.map(([weight, reps, kind]) => ({ weight, reps, kind: kind ?? null })), ...extra });
const rx = (sets: number, repMin: number, repMax: number): Prescription => ({ sets, repMin, repMax });
const barbell = buildProfile({ equipment: 'Barbell', mechanic: 'compound', tracking: 'weight_reps' }, 'lb');
const dumbbell = buildProfile({ equipment: 'Dumbbell', mechanic: 'compound', tracking: 'weight_reps', load: 'total' }, 'lb');
const raise = buildProfile({ equipment: 'Dumbbell', mechanic: 'isolation', tracking: 'weight_reps' }, 'lb');
const machine = buildProfile({ equipment: 'Machine', mechanic: 'compound', tracking: 'weight_reps' }, 'lb');
const cable = buildProfile({ equipment: 'Cable', mechanic: 'isolation', tracking: 'weight_reps' }, 'lb');
const pullup = buildProfile({ equipment: 'Bodyweight', mechanic: 'compound', tracking: 'bodyweight_reps' }, 'lb');
const assisted = buildProfile({ equipment: 'Machine', mechanic: 'compound', tracking: 'assisted_reps' }, 'lb');
const plank = buildProfile({ equipment: 'Bodyweight', tracking: 'duration' }, 'lb');
const run = (s: PastSession[], r: Prescription, p = barbell) => recommend(s, r, p);

// ---------- basic progression ----------
test('1 no history: no invented weight, guidance only', () => {
  const t = run([], rx(3, 8, 12));
  assert.equal(t.action, 'start'); assert.equal(t.weight, null); assert.match(t.reason, /about 14 times/);
});
test('2 below range: hold the weight, raise the weakest set', () => {
  const t = run([sess([[190, 6], [190, 5], [190, 4]])], rx(3, 6, 8));
  assert.equal(t.weight, 190); assert.deepEqual(t.repsBySet, [6, 5, 5]); assert.match(t.reason, /under the 6 minimum/);
});
test('3 within range: keep sets that are done, +1 on the weakest', () => {
  const t = run([sess([[70, 8], [70, 8], [70, 7]])], rx(3, 8, 10), dumbbell);
  assert.deepEqual(t.repsBySet, [8, 8, 8]); assert.equal(t.weight, 70);
});
test('3b brief example: 8, 8, 8 becomes 9, 8, 8 (earliest set on a tie)', () => {
  assert.deepEqual(run([sess([[70, 8], [70, 8], [70, 8]])], rx(3, 8, 10), dumbbell).repsBySet, [9, 8, 8]);
});
test('4 all sets at the top: add the exercise step, back to the bottom', () => {
  const t = run([sess([[185, 8], [185, 8], [185, 8]])], rx(3, 6, 8));
  assert.equal(t.action, 'add_weight'); assert.equal(t.weight, 190); assert.deepEqual(t.repsBySet, [6, 6, 6]);
});
test('5 one set at the top is not enough to add weight', () => {
  const t = run([sess([[185, 8], [185, 7], [185, 6]])], rx(3, 6, 8));
  assert.equal(t.action, 'add_reps'); assert.deepEqual(t.repsBySet, [8, 7, 7]);
});
test('6 uneven sets: a strong set is never asked to do less (old engine regressed it)', () => {
  const t = run([sess([[100, 10], [100, 9], [100, 8]])], rx(3, 8, 10));
  assert.deepEqual(t.repsBySet, [10, 9, 9]);
  assert.equal(suggestTarget([{ weight: 100, reps: 10 }, { weight: 100, reps: 9 }, { weight: 100, reps: 8 }], 8, 10).reps, 9, 'old: 9 on every set, below set 1');
});
test('7 rep improvements without load change keep the weight', () => {
  const t = run([sess([[100, 8], [100, 8], [100, 8]]), sess([[100, 9], [100, 8], [100, 8]])], rx(3, 8, 10));
  assert.equal(t.weight, 100); assert.deepEqual(t.repsBySet, [9, 9, 8]);
});
test('8 load went up without rep gains: targets build on the new weight', () => {
  const t = run([sess([[185, 8], [185, 8], [185, 8]]), sess([[190, 6], [190, 6], [190, 6]])], rx(3, 6, 8));
  assert.equal(t.weight, 190); assert.deepEqual(t.repsBySet, [7, 6, 6]);
});
test('9 first session after an increase: from the bottom of the range up', () => {
  const t = run([sess([[190, 6], [190, 6], [190, 5]])], rx(3, 6, 8));
  assert.deepEqual(t.repsBySet, [6, 6, 6]); assert.equal(t.alternative, undefined);
});
test('10 repeated underperformance: after 3 misses offer one step lighter, never forced', () => {
  const h = [sess([[185, 8], [185, 8], [185, 8]]), sess([[190, 6], [190, 6], [190, 5]]), sess([[190, 6], [190, 6], [190, 5]]), sess([[190, 6], [190, 5], [190, 5]])];
  const t = run(h, rx(3, 6, 8));
  assert.equal(t.weight, 190, 'the target itself stays');
  assert.equal(t.alternative?.weight, 185); assert.match(t.alternative!.label, /185 lb/); assert.match(t.caution!, /last 3 workouts/);
  const two = run(h.slice(0, 3), rx(3, 6, 8));
  assert.equal(two.alternative, undefined); assert.ok(two.details.some(d => /lighter option/.test(d)));
});
test('53 one bad workout does not trigger the lighter option', () => {
  const t = run([sess([[190, 7], [190, 7], [190, 6]]), sess([[190, 5], [190, 5], [190, 4]])], rx(3, 6, 8));
  assert.equal(t.alternative, undefined);
});
test('54 one strong workout counts once: weight goes up one step only', () => {
  const t = run([sess([[100, 12], [100, 12], [100, 12]])], rx(3, 8, 10));
  assert.equal(t.weight, 105); assert.deepEqual(t.repsBySet, [8, 8, 8]);
});

// ---------- set structure ----------
test('11 warm-ups (marked) never count', () => {
  const t = run([sess([[95, 8, 'warmup'], [135, 5, 'warmup'], [185, 8], [185, 7], [185, 6]])], rx(3, 6, 8));
  assert.equal(t.weight, 185); assert.deepEqual(t.repsBySet, [8, 7, 7]); assert.ok(t.details.some(d => /Warm-up sets are not counted/.test(d)));
});
test('11b warm-ups (old, unmarked) are inferred only when clear', () => {
  const t = run([sess([[95, 8], [135, 5], [185, 8], [185, 7], [185, 6]])], rx(3, 6, 8));
  assert.equal(t.weight, 185); assert.ok(t.details.some(d => /treated as warm-ups/.test(d)));
});
test('12 drop sets never count', () => {
  const t = run([sess([[100, 10], [100, 10], [100, 10], [70, 12, 'drop']])], rx(3, 8, 10));
  assert.equal(t.action, 'add_weight'); assert.equal(t.weight, 105);
});
test('13/14 top set + back-offs: the heavier set is named and left out, not silently merged', () => {
  const t = run([sess([[205, 5], [185, 8], [185, 8]])], rx(3, 6, 8));
  assert.equal(t.weight, 185); assert.ok(t.details.some(d => /205 lb set was heavier/.test(d)));
  assert.notEqual(t.action, 'add_weight', 'only 2 sets at 185: no weight increase yet');
});
test('15/16 pyramids (one set per weight): the engine says it is unclear', () => {
  for (const s of [[[185, 8], [195, 6], [205, 4]], [[205, 4], [195, 6], [185, 8]]] as S[][]) {
    const t = run([sess(s)], rx(3, 6, 8));
    assert.equal(t.action, 'review'); assert.equal(t.weight, null); assert.equal(headline(t, 'lb'), 'Your call today');
  }
});
test('17 mixed loads with a clear main weight', () => {
  const t = run([sess([[135, 10], [145, 8], [145, 7]])], rx(2, 6, 8));
  assert.equal(t.weight, 145); assert.deepEqual(t.repsBySet, [8, 8]);
});
test('18/19 skipped and zero-rep sets are ignored', () => {
  const s = sess([[100, 10], [100, 10]]); s.sets.push({ weight: 100, reps: 4, skipped: true }, { weight: 100, reps: 0 });
  assert.equal(run([s], rx(2, 8, 10)).action, 'add_weight');
});
test('20 fewer sets than planned: finish them before adding weight', () => {
  const t = run([sess([[100, 10], [100, 10]])], rx(3, 8, 10));
  assert.equal(t.action, 'hold'); assert.deepEqual(t.repsBySet, [10, 10, 10]); assert.match(t.reason, /Do all 3 sets/);
});
test('20b more sets than planned: the planned ones decide', () => {
  const t = run([sess([[100, 10], [100, 10], [100, 10], [100, 6]])], rx(3, 8, 10));
  assert.equal(t.action, 'add_weight');
});
test('21 legacy records with no set types behave like before when clear', () => {
  const t = run([sess([[45, 15], [135, 10], [135, 10]])], rx(2, 8, 10));
  assert.equal(t.action, 'add_weight'); assert.equal(t.weight, 140);
});
test('failure sets still count as working sets', () => {
  assert.equal(run([sess([[100, 10], [100, 10], [100, 10, 'failure']])], rx(3, 8, 10)).action, 'add_weight');
});

// ---------- exercise and equipment ----------
test('22 barbell: 5 lb step', () => assert.equal(run([sess([[135, 10], [135, 10]])], rx(2, 8, 10)).weight, 140));
test('23 dumbbells: per dumbbell, never doubled', () => {
  const t = run([sess([[70, 10], [70, 10], [70, 10]])], rx(3, 8, 10), dumbbell);
  assert.equal(t.weight, 75); assert.equal(stepText(dumbbell), '5 lb per dumbbell'); assert.ok(t.details[0].includes('per dumbbell'));
});
test('24 machine stack: 10 lb step', () => assert.equal(run([sess([[270, 12], [270, 12], [270, 12]])], rx(3, 10, 12), machine).weight, 280));
test('25 cable stack: 10 lb by default, user step wins', () => {
  assert.equal(run([sess([[40, 15], [40, 15]])], rx(2, 12, 15), cable).weight, 50);
  const mine = buildProfile({ equipment: 'Cable', mechanic: 'isolation' }, 'lb', { weightStepLb: 2.5 });
  const t = run([sess([[40, 15], [40, 15]])], rx(2, 12, 15), mine);
  assert.equal(t.weight, 42.5); assert.ok(t.details.some(d => /your setting/.test(d)));
});
test('big relative jumps get a heads-up (15 to 20 lb is 33%)', () => {
  const t = run([sess([[15, 15], [15, 15], [15, 15]])], rx(3, 12, 15), raise);
  assert.equal(t.weight, 20); assert.match(t.caution!, /33% jump/);
  assert.equal(run([sess([[185, 8], [185, 8]])], rx(2, 6, 8)).caution, undefined);
});
test('26 unilateral: reps are compared as logged (per side), nothing doubled', () => {
  const uni = buildProfile({ equipment: 'Dumbbell', mechanic: 'compound' }, 'lb');
  assert.deepEqual(run([sess([[40, 10], [40, 9]])], rx(2, 8, 12), uni).repsBySet, [10, 10]);
});
test('27 bodyweight at the top: harder variation, no invented weight', () => {
  const t = run([sess([[0, 12], [0, 12], [0, 12]])], rx(3, 8, 12), pullup);
  assert.equal(t.action, 'harder_variation'); assert.equal(t.weight, null);
});
test('27b bodyweight below the top: one more rep, no weight shown', () => {
  const t = run([sess([[0, 8], [0, 7], [0, 6]])], rx(3, 6, 10), pullup);
  assert.equal(t.weight, 0); assert.deepEqual(t.repsBySet, [8, 7, 7]); assert.equal(headline(t, 'lb'), 'Bodyweight × 8, 7, 7'); assert.doesNotMatch(t.reason, /0 lb/);
});
test('28 weighted pull-up: added weight goes up by the bodyweight step', () => {
  const t = run([sess([[25, 8], [25, 8], [25, 8]])], rx(3, 6, 8), pullup);
  assert.equal(t.action, 'add_weight'); assert.equal(t.weight, 30);
});
test('29 assisted: progress means LESS assistance, a lighter option means more', () => {
  const up = run([sess([[60, 10], [60, 10], [60, 10]])], rx(3, 8, 10), assisted);
  assert.equal(up.action, 'less_assistance'); assert.equal(up.weight, 50);
  const h = [sess([[50, 6], [50, 6], [50, 5]]), sess([[50, 6], [50, 6], [50, 5]]), sess([[50, 6], [50, 5], [50, 5]])];
  assert.equal(run(h, rx(3, 8, 10), assisted).alternative?.weight, 60);
});
test('30 time-based: seconds, 5 s steps, harder at the top, never "add weight" numbers', () => {
  const t = run([sess([[0, 45], [0, 40], [0, 35]])], rx(3, 30, 60), plank);
  assert.equal(t.measure, 'seconds'); assert.deepEqual(t.repsBySet, [45, 40, 40]);
  const top = run([sess([[0, 60], [0, 60], [0, 60]])], rx(3, 30, 60), plank);
  assert.equal(top.action, 'harder_variation'); assert.match(top.reason, /60s on every set/);
  assert.equal(restFor(plank, rx(3, 30, 60)), 75);
});
test('31 custom exercise with no library facts: plain weight x reps, 5 lb', () => {
  const t = run([sess([[50, 12], [50, 12]])], rx(2, 10, 12), buildProfile(null, 'lb'));
  assert.equal(t.weight, 55);
});

// ---------- data consistency ----------
test('32 changing rep ranges: overlapping carries over, a different goal asks', () => {
  const s = sess([[100, 10], [100, 10], [100, 10]], { prescription: { sets: 3, repMin: 8, repMax: 10 } });
  assert.equal(run([s], rx(3, 8, 12)).action, 'add_reps');
  const t = run([s], rx(5, 3, 5));
  assert.equal(t.action, 'review'); assert.match(t.reason, /8-10 to 3-5/);
  assert.equal(comparable({ ...s, prescription: null }, rx(5, 3, 5)), true, 'old rows without a prescription are comparable');
});
test('35 back after a long break: targets build on the last session (no decay invented)', () => {
  assert.equal(run([{ at: '2026-01-01T10:00:00Z', sets: [{ weight: 100, reps: 9 }] }], rx(1, 8, 10)).weight, 100);
});
test('36 deload sessions never lower the baseline', () => {
  const t = run([sess([[200, 8], [200, 7], [200, 7]]), sess([[160, 6], [160, 6]], { isDeload: true })], rx(3, 6, 8));
  assert.equal(t.weight, 200); assert.deepEqual(t.repsBySet, [8, 8, 7]);
});
test('37/39 incomplete (no done sets) and missing history', () => {
  assert.equal(eligible([sess([[100, 0]])]).length, 0);
  assert.equal(run([sess([[100, 0]])], rx(3, 8, 10)).action, 'start');
});
test('38 duplicate set rows are counted as logged (nothing is invented or merged)', () => {
  const t = run([sess([[100, 10], [100, 10], [100, 10], [100, 10]])], rx(3, 8, 10));
  assert.equal(t.action, 'add_weight');
});
test('40 ambiguous history never produces a confident number', () => {
  const r = readWorking([{ weight: 100, reps: 10 }, { weight: 110, reps: 8 }, { weight: 120, reps: 6 }, { weight: 130, reps: 4 }]);
  assert.equal(r.kind, 'unclear');
});

// ---------- units and increments ----------
test('41/42 pounds and kilograms', () => {
  const kg = buildProfile({ equipment: 'Barbell' }, 'kg');
  assert.equal(run([sess([[100, 8], [100, 8]])], rx(2, 6, 8), kg).weight, 102.5);
  assert.equal(run([sess([[225, 8], [225, 8]])], rx(2, 6, 8)).weight, 230);
});
test('43/47 a step set in pounds shows correctly in kg', () => {
  const p = buildProfile({ equipment: 'Dumbbell' }, 'kg', { weightStepLb: 4.41 });
  assert.equal(p.step, 2); assert.equal(run([sess([[20, 10], [20, 10]])], rx(2, 8, 10), p).weight, 22);
});
test('44/45 rounding to loadable weights (0.5 kg, 0.1 lb), small plates allowed', () => {
  assert.equal(loadableWeight(61.27, 'kg'), 61.5); assert.equal(loadableWeight(102.26, 'lb'), 102.3);
  const small = buildProfile({ equipment: 'Barbell' }, 'kg', { weightStepLb: 2.2 });
  assert.equal(run([sess([[60, 8], [60, 8]])], rx(2, 6, 8), small).weight, 61);
});
test('46 large machine increments', () => {
  const big = buildProfile({ equipment: 'Machine' }, 'lb', { weightStepLb: 20 });
  assert.equal(run([sess([[300, 12], [300, 12]])], rx(2, 10, 12), big).weight, 320);
});
test('48 a target is always reachable from the last weight by one step', () => {
  const t = run([sess([[61.2, 8], [61.2, 8]])], rx(2, 6, 8), buildProfile({ equipment: 'Barbell' }, 'kg'));
  assert.equal(t.weight, 63.5);
});

// ---------- effort ----------
test('49-51 RIR and effort are stored but never move the target (by design for now)', () => {
  const a = sess([[185, 8], [185, 8], [185, 8]]); a.sets.forEach(s => (s.rir = 3));
  const b = sess([[185, 8], [185, 8], [185, 8]]); b.sets.forEach(s => (s.rir = 0));
  const ta = run([a], rx(3, 6, 8)), tb = run([b], rx(3, 6, 8));
  assert.equal(ta.action, tb.action); assert.equal(ta.weight, tb.weight); assert.deepEqual(ta.repsBySet, tb.repsBySet);
});
test('52 repeated stable performance: hold, still one rep to aim for', () => {
  const h = [sess([[100, 9], [100, 9], [100, 9]]), sess([[100, 9], [100, 9], [100, 9]]), sess([[100, 9], [100, 9], [100, 9]])];
  assert.deepEqual(run(h, rx(3, 8, 10)).repsBySet, [10, 9, 9]);
});
test('55 conflicting signals: the latest session decides, older misses only add an option', () => {
  const h = [sess([[190, 5], [190, 5], [190, 5]]), sess([[190, 5], [190, 5], [190, 5]]), sess([[190, 8], [190, 8], [190, 8]])];
  const t = run(h, rx(3, 6, 8));
  assert.equal(t.action, 'add_weight'); assert.equal(t.alternative, undefined);
});
test('56 two sessions are not enough for the lighter option', () => {
  assert.equal(sessionsBelowMin([sess([[190, 5]]), sess([[190, 5]])].reverse(), rx(1, 6, 8), 190), 2);
});

// ---------- user control and safety ----------
test('57-59 the target is only a suggestion: logged values are what the next target reads', () => {
  const t = run([sess([[200, 6], [200, 6], [200, 6]])], rx(3, 6, 8)); // they typed 200 instead of the suggested 190
  assert.equal(t.weight, 200);
});
test('61 the engine never changes its input (history stays immutable)', () => {
  const h = [sess([[100, 10], [100, 9]])]; const copy = JSON.stringify(h);
  run(h, rx(3, 8, 10)); assert.equal(JSON.stringify(h), copy);
});
test('62 recommendations carry the strategy and version', () => {
  const t = run([], rx(3, 8, 10)); assert.equal(t.strategy, 'double'); assert.equal(t.version, 'double-2');
});
test('69 a failure inside the engine never blocks logging', () => {
  const broken = { ...barbell, get step(): number { throw new Error('boom'); } };
  const t = recommend([sess([[100, 10], [100, 10]])], rx(2, 8, 10), broken);
  assert.equal(t.action, 'review'); assert.match(t.reason, /Log as usual/);
});
test('holdTargets: caps at the top, fills missing sets from the weakest set', () => {
  assert.deepEqual(holdTargets([12, 11], rx(3, 8, 12)), [12, 12, 11]);
  assert.deepEqual(holdTargets([], rx(2, 8, 12)), [9, 8]);
});

// ---------- rest ----------
test('rest: compounds unchanged, isolation capped, own setting wins', () => {
  assert.equal(restFor(barbell, rx(3, 4, 6)), 180); assert.equal(restFor(barbell, rx(3, 8, 10)), 120);
  assert.equal(restFor(raise, rx(3, 8, 10)), 90); assert.equal(restFor(raise, rx(3, 4, 6)), 120);
  assert.equal(restFor({ ...raise, restOverride: 45 }, rx(3, 8, 10)), 45);
});

// ---------- database rows ----------
test('database rows: unit conversion, order, set types, prescription, incomplete sessions dropped', () => {
  const s = toSessions([
    { exercise_name: 'Bench', exercise_id: 'b', target_sets: 3, target_rep_min: 6, target_rep_max: 8, workout_sessions: { id: 's1', completed_at: '2026-11-20T18:00:00Z', is_deload: false },
      exercise_sets: [{ set_number: 2, reps: 8, weight: 220.46, set_type: 'working' }, { set_number: 1, reps: 5, weight: 132.28, set_type: 'warmup' }] },
    { exercise_name: 'Bench', exercise_id: 'b', workout_sessions: { completed_at: '' }, exercise_sets: [] },
  ], 'kg');
  assert.equal(s.length, 1); assert.deepEqual(s[0].sets.map(x => [x.weight, x.kind]), [[60, 'warmup'], [100, 'working']]);
  assert.deepEqual(s[0].prescription, { sets: 3, repMin: 6, repMax: 8 });
  assert.equal(exerciseKey({ exercise_id: null, exercise_name: ' Cable Fly ' }), 'name:cable fly');
});
