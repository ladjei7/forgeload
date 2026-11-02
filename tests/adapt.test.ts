import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIB, SEED_PLAN, SEED_HIST, levelOf, type Hist } from '../app/design-preview/data.ts';
import { suggest, preferenceSuggestions, applyChange, type AdaptIn, type Ev } from '../app/design-preview/adapt.ts';

const base = (o: Partial<AdaptIn> = {}): AdaptIn => ({ plan: SEED_PLAN, hist: { ...SEED_HIST, lateral: SEED_HIST.lateral.slice(0, 1) }, events: [], dismissed: [], comfort: 'all', avoid: [], planTime: 60, lib: LIB, ...o });
const sw = (from: string, to: string, ds: number[]): Ev[] => ds.map((d) => ({ k: 'swap', from, to, d }));

test('no behavior, no suggestions', () => assert.deepEqual(suggest(base()), []));
test('rule 1: three swaps of the same pair become one suggestion, with history preserved in the wording', () => {
  const s = suggest(base({ events: sw('row', 'cablerow', [2, 9, 16]) }));
  assert.equal(s.length, 1); assert.equal(s[0].kind, 'repeat-swap');
  assert.match(s[0].why, /3 times/); assert.match(s[0].why, /history/);
});
test('rule 1: two swaps are not enough; old swaps outside the window do not count', () => {
  assert.equal(suggest(base({ events: sw('row', 'cablerow', [2, 9]) })).length, 0);
  assert.equal(suggest(base({ events: sw('row', 'cablerow', [2, 9, 60]) })).length, 0);
});
test('accepting a swap changes the plan only where asked and keeps logged history untouched', () => {
  const histBefore = JSON.stringify(SEED_HIST);
  const s = suggest(base({ events: sw('row', 'cablerow', [1, 2, 3]) }))[0];
  const next = applyChange(SEED_PLAN, s.change);
  assert.ok(next.flatMap((d) => d.ex).some((e) => e.exId === 'cablerow')); assert.ok(!next.flatMap((d) => d.ex).some((e) => e.exId === 'row'));
  assert.equal(JSON.stringify(SEED_HIST), histBefore); assert.ok(SEED_HIST.row.length > 0);
  assert.ok(SEED_PLAN.flatMap((d) => d.ex).some((e) => e.exId === 'row'), 'the original plan object is not mutated');
});
test('rule 2: marked not-for-me suggests a same-pattern alternative inside the comfort range', () => {
  const s = suggest(base({ comfort: 'machines', plan: SEED_PLAN.map((d) => ({ ...d, ex: d.ex.map((e) => (e.exId === 'bench' ? { ...e, exId: 'chestpm' } : e)) })), events: [{ k: 'feel', ex: 'chestpm', v: 'notforme', d: 1 }] }));
  assert.equal(s[0].kind, 'not-for-me'); assert.equal(s[0].change.t, 'replace');
  const to = (s[0].change as { to: string }).to; assert.equal(levelOf(LIB.find((e) => e.id === to)!), 1);
});
test('rule 2: three skips triggers it; one skip does not', () => {
  assert.equal(suggest(base({ events: [{ k: 'skip', ex: 'lunge', d: 1 }] })).length, 0);
  assert.equal(suggest(base({ events: [3, 8, 12].map((d) => ({ k: 'skip' as const, ex: 'lunge', d })) }))[0].kind, 'not-for-me');
});
test('rule 3: three sessions without a better top set suggests a variation, never a weight or comfort change', () => {
  const hist: Hist = { ...SEED_HIST, lateral: SEED_HIST.lateral.slice(0, 1), ohp: [{ daysAgo: 2, sets: [{ w: 75, r: 6 }] }, { daysAgo: 9, sets: [{ w: 75, r: 6 }] }, { daysAgo: 16, sets: [{ w: 75, r: 7 }] }] };
  const s = suggest(base({ hist })).filter((x) => x.kind === 'stalled');
  assert.equal(s.length, 1); assert.match(s[0].why, /Keeping this exercise is also a fine choice/);
});
test('rule 3: steady progress does not trigger it', () => assert.equal(suggest(base()).filter((x) => x.kind === 'stalled').length, 0));
test('rule 4: a workout longer than the chosen session length offers to drop the smallest exercise', () => {
  const s = suggest(base({ planTime: 30 })).filter((x) => x.kind === 'time');
  assert.ok(s.length >= 1); const ch = s[0].change; assert.equal(ch.t, 'remove');
  const day = SEED_PLAN.find((d) => d.id === (ch as { dayId: string }).dayId)!; assert.ok(applyChange(SEED_PLAN, ch).find((d) => d.id === day.id)!.ex.length === day.ex.length - 1);
  assert.equal(suggest(base({ planTime: 60 })).filter((x) => x.kind === 'time').length, 0);
});
test('rule 5: comfort moves only on explicit "comfortable" answers from 3 different exercises', () => {
  const good = (ids: string[]): Ev[] => ids.map((ex, i) => ({ k: 'feel', ex, v: 'good', d: i }));
  assert.equal(suggest(base({ comfort: 'machines', events: good(['chestpm', 'mrow']) })).length, 0);
  const s = suggest(base({ comfort: 'machines', events: good(['chestpm', 'mrow', 'legpress']) })).find((x) => x.kind === 'comfort')!;
  assert.deepEqual(s.change, { t: 'comfort', to: 'mixed' });
  assert.equal(suggest(base({ comfort: 'machines', events: [...good(['chestpm', 'mrow', 'legpress']), { k: 'feel', ex: 'hack', v: 'unsure', d: 1 }] })).some((x) => x.kind === 'comfort'), false);
});
test('GUARD: huge performance gains never produce a comfort or barbell suggestion', () => {
  const hist: Hist = { chestpm: [0, 1, 2, 3, 4].map((i) => ({ daysAgo: i * 3, sets: [{ w: 200 - i * 20, r: 12 }, { w: 200 - i * 20, r: 12 }] })) };
  const plan = SEED_PLAN.map((d) => ({ ...d, ex: d.ex.map((e) => (e.exId === 'bench' ? { ...e, exId: 'chestpm' } : e)) }));
  for (const comfort of ['machines', 'mixed', 'unsure'] as const) {
    const s = suggest(base({ comfort, plan, hist }));
    assert.ok(!s.some((x) => x.kind === 'comfort'), comfort);
    for (const x of s) if (x.change.t === 'replace') assert.notEqual(LIB.find((e) => e.id === (x.change as { to: string }).to)!.equip, 'Barbell');
  }
});
test('suggested replacements respect comfort and avoid lists', () => {
  const s = suggest(base({ comfort: 'mixed', avoid: ['cablerow'], events: [{ k: 'feel', ex: 'row', v: 'notforme', d: 1 }] }));
  assert.ok(s.length > 0); for (const x of s) if (x.change.t === 'replace') { const to = x.change.to; assert.ok(levelOf(LIB.find((e) => e.id === to)!) <= 2); assert.notEqual(to, 'cablerow'); }
});
test('dismissed suggestions stay hidden; every suggestion explains itself', () => {
  const ev = sw('row', 'cablerow', [1, 2, 3]); const s = suggest(base({ events: ev }));
  assert.equal(suggest(base({ events: ev, dismissed: [s[0].id] })).length, 0);
  for (const x of s) { assert.ok(x.why.length > 30); assert.ok(x.title && x.accept); }
});
test('preference change: moving to machines offers swaps for non-machine exercises, applies nothing, never touches history', () => {
  const p = preferenceSuggestions(SEED_PLAN, 'machines', [], LIB);
  assert.ok(p.length > 0); const histBefore = JSON.stringify(SEED_HIST);
  for (const x of p) { assert.equal(x.change.t, 'replace'); assert.equal(levelOf(LIB.find((e) => e.id === (x.change as { to: string }).to)!), 1); }
  assert.equal(JSON.stringify(SEED_HIST), histBefore);
});
test('preference change: moving up is optional and offers at most the next level, only for main lifts', () => {
  const plan = SEED_PLAN.map((d) => ({ ...d, ex: d.ex.map((e) => (e.exId === 'bench' ? { ...e, exId: 'chestpm' } : e)) }));
  const p = preferenceSuggestions(plan, 'mixed', [], LIB);
  for (const x of p) { const to = (x.change as { to: string }).to; assert.ok(levelOf(LIB.find((e) => e.id === to)!) <= 2); }
});
