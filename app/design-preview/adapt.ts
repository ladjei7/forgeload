// Suggestion engine v1. Explainable rules over things the user did or said. Pure functions: no learning model, no hidden state.
// Guardrails (each one has a test):
//  - It only ever proposes. Nothing here changes a plan; the UI applies a suggestion only when the user accepts it.
//  - Comfort and technique are never inferred from weights or reps. Comfort only moves on an explicit answer from the user.
//  - Barbells are never suggested because the user is progressing.
//  - Replacements stay inside the user's comfort level and avoid list. The one exception is something the user chose themselves (rule 1).
import { estMinutes, levelOf, comfortLevel, PATTERN, type Comfort, type Day, type Hist, type LibEx } from './data.ts';
import { candidates, MAJOR } from './generate.ts';

/** Things the user did or said. d = days ago. Kept as an append-only log; plans and history are never rewritten from it. */
export type Ev =
  | { k: 'swap'; from: string; to: string; d: number }
  | { k: 'skip'; ex: string; d: number }
  | { k: 'feel'; ex: string; v: 'good' | 'unsure' | 'notforme'; d: number };

export type Change =
  | { t: 'replace'; from: string; to: string; dayIds?: string[] }
  | { t: 'remove'; dayId: string; peId: string }
  | { t: 'comfort'; to: Comfort };
export type Suggestion = { tier: 'free' | 'pro'; id: string; kind: 'repeat-swap' | 'not-for-me' | 'stalled' | 'time' | 'comfort' | 'preference'; title: string; why: string; accept: string; change: Change };
export type AdaptIn = { plan: Day[]; hist: Hist; events: Ev[]; dismissed: string[]; comfort: Comfort; avoid: string[]; planTime: number; lib: LibEx[] };

/** Free: save repeated substitutions, honor "not for me", offer comfort options. Pro: analysis of how training is going (plateaus, volume and time fit). */
export const PRO_KINDS: Suggestion['kind'][] = ['stalled', 'time'];
const nm = (lib: LibEx[], id: string) => lib.find((e) => e.id === id)?.name ?? id;
const inPlan = (plan: Day[], id: string) => plan.some((d) => d.ex.some((e) => e.exId === id));
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const WINDOW = 30; // days of behavior that count

/** First allowed same-pattern alternative for an exercise, or undefined. */
export function alternative(exId: string, level: 1 | 2 | 3, avoid: string[], taken: string[]): string | undefined {
  const p = PATTERN[exId]; if (!p) return undefined;
  return candidates(p, level, new Set([...avoid, ...taken, exId]))[0];
}

export function suggest(i: AdaptIn): Suggestion[] {
  const out: Omit<Suggestion, 'tier'>[] = []; const level = comfortLevel(i.comfort);
  const recent = i.events.filter((e) => e.d <= WINDOW);

  // 1. Repeat swap: the user keeps replacing A with B. Offer to make B the default.
  const pairs = new Map<string, number>();
  for (const e of recent) if (e.k === 'swap') pairs.set(`${e.from}>${e.to}`, (pairs.get(`${e.from}>${e.to}`) ?? 0) + 1);
  for (const [key, n] of pairs) {
    const [from, to] = key.split('>'); if (n < 3 || !inPlan(i.plan, from) || from === to) continue;
    const days = i.plan.filter((d) => d.ex.some((e) => e.exId === from) && !d.ex.some((e) => e.exId === to)).map((d) => d.id);
    if (!days.length) continue;
    out.push({ id: `repeat:${key}`, kind: 'repeat-swap', title: `Use ${nm(i.lib, to)} instead of ${nm(i.lib, from)}?`,
      why: `You swapped ${nm(i.lib, from)} for ${nm(i.lib, to)} ${times(n)} in the last month. Making it the default saves you the swap. Your past ${nm(i.lib, from)} sets stay in your history.`,
      accept: 'Make it the default', change: { t: 'replace', from, to, dayIds: days } });
  }

  // 2. Not for me: skipped 3 times, or marked "not for me" at least once. Offer a same-pattern alternative inside the comfort range.
  const exIds = new Set(recent.flatMap((e) => (e.k === 'skip' || e.k === 'feel' ? [e.ex] : [])));
  for (const ex of exIds) {
    if (!inPlan(i.plan, ex)) continue;
    const skips = recent.filter((e) => e.k === 'skip' && e.ex === ex).length; const no = recent.filter((e) => e.k === 'feel' && e.ex === ex && e.v === 'notforme').length;
    if (skips < 3 && no < 1) continue;
    const alt = alternative(ex, level, i.avoid, i.plan.flatMap((d) => d.ex.map((e) => e.exId))); if (!alt) continue;
    out.push({ id: `nfm:${ex}`, kind: 'not-for-me', title: `Try ${nm(i.lib, alt)} instead of ${nm(i.lib, ex)}?`,
      why: no ? `You marked ${nm(i.lib, ex)} as not for you. ${nm(i.lib, alt)} works the same movement and fits your comfort setting.` : `You skipped ${nm(i.lib, ex)} ${times(skips)} recently. ${nm(i.lib, alt)} works the same movement and fits your comfort setting.`,
      accept: `Swap to ${nm(i.lib, alt)}`, change: { t: 'replace', from: ex, to: alt } });
  }

  // 3. Stalled: three sessions in a row with no better top set. Suggest a variation only. Never changes weight or comfort.
  for (const d of i.plan) for (const pe of d.ex) {
    const h = i.hist[pe.exId]; if (!h || h.length < 3) continue;
    const best = (s: (typeof h)[number]) => s.sets.reduce((a, x) => (x.w > a.w || (x.w === a.w && x.r > a.r) ? x : a), { w: 0, r: 0 });
    const [a, b, c] = [best(h[0]), best(h[1]), best(h[2])]; const better = (x: typeof a, y: typeof a) => x.w > y.w || (x.w === y.w && x.r > y.r);
    if (better(a, b) || better(b, c) || better(a, c)) continue;
    const alt = alternative(pe.exId, level, i.avoid, d.ex.map((e) => e.exId)); if (!alt) continue;
    if (out.some((s) => s.kind === 'stalled' && s.change.t === 'replace' && s.change.from === pe.exId)) continue;
    out.push({ id: `stall:${pe.exId}`, kind: 'stalled', title: `${nm(i.lib, pe.exId)} has not moved in 3 sessions`,
      why: `Your best set has not improved over the last three sessions. A different variation, ${nm(i.lib, alt)}, sometimes gets things moving again. Keeping this exercise is also a fine choice.`,
      accept: `Try ${nm(i.lib, alt)}`, change: { t: 'replace', from: pe.exId, to: alt, dayIds: [d.id] } });
  }

  // 4. Time: a workout is longer than the session length the user set. Offer to drop the smallest exercise.
  for (const d of i.plan) {
    if (d.ex.length <= 3 || estMinutes(d.ex) <= i.planTime) continue;
    const small = [...d.ex].reverse().find((e) => !MAJOR.includes(PATTERN[e.exId])) ?? d.ex[d.ex.length - 1];
    const after = estMinutes(d.ex.filter((e) => e.id !== small.id));
    out.push({ id: `time:${d.id}`, kind: 'time', title: `${d.name} is longer than ${i.planTime} min`,
      why: `${d.name} takes about ${estMinutes(d.ex)} minutes and you set ${i.planTime}. Removing ${nm(i.lib, small.exId)} brings it to about ${after}. Your history for it stays.`,
      accept: `Remove ${nm(i.lib, small.exId)}`, change: { t: 'remove', dayId: d.id, peId: small.id } });
  }

  // 5. Comfort up. ONLY from explicit "comfortable" answers on at least 3 different exercises. Performance numbers are never read here.
  if (level < 3) {
    const good = new Set(recent.filter((e) => e.k === 'feel' && e.v === 'good').map((e) => (e as { ex: string }).ex));
    const bad = recent.some((e) => e.k === 'feel' && e.v !== 'good');
    if (good.size >= 3 && !bad) {
      const next: Comfort = level === 1 ? 'mixed' : 'all';
      out.push({ id: `comfort:${next}`, kind: 'comfort', title: level === 1 ? 'Open up dumbbell options?' : 'Open up barbell options?',
        why: `You told us ${good.size} exercises felt comfortable. If you like, we can start offering ${level === 1 ? 'dumbbell' : 'barbell'} options when you swap or add exercises. This only changes the options we show. Your plan stays as it is.`,
        accept: 'Yes, include them', change: { t: 'comfort', to: next } });
    }
  }
  return out.filter((s) => !i.dismissed.includes(s.id)).map((s) => ({ ...s, tier: PRO_KINDS.includes(s.kind) ? 'pro' : 'free' }));
}

/** After the user changes their comfort setting: optional per-exercise swaps. Nothing is applied by this function. */
export function preferenceSuggestions(plan: Day[], comfort: Comfort, avoid: string[], lib: LibEx[]): Suggestion[] {
  const level = comfortLevel(comfort); const taken = plan.flatMap((d) => d.ex.map((e) => e.exId)); const out: Suggestion[] = []; const seen = new Set<string>();
  for (const d of plan) for (const pe of d.ex) {
    const ex = lib.find((e) => e.id === pe.exId); const p = PATTERN[pe.exId]; if (!ex || !p || seen.has(pe.exId)) continue;
    const l = levelOf(ex);
    if (l > level) {
      const alt = candidates(p, level, new Set([...avoid, ...taken]))[0]; if (!alt) continue; seen.add(pe.exId);
      out.push({ tier: 'free', id: `pref:${pe.exId}>${alt}`, kind: 'preference', title: `${nm(lib, pe.exId)} → ${nm(lib, alt)}`, why: `${nm(lib, alt)} suits your new comfort setting and trains the same movement.`, accept: 'Swap', change: { t: 'replace', from: pe.exId, to: alt } });
    } else if (l < level && MAJOR.includes(p)) {
      const alt = candidates(p, level, new Set([...avoid, ...taken])).find((id) => { const e2 = lib.find((x) => x.id === id); return e2 && levelOf(e2) === level; }); if (!alt) continue; seen.add(pe.exId);
      out.push({ tier: 'free', id: `pref:${pe.exId}>${alt}`, kind: 'preference', title: `${nm(lib, pe.exId)} → ${nm(lib, alt)}`, why: `An option for your new comfort setting. Keep what you have if you prefer it.`, accept: 'Swap', change: { t: 'replace', from: pe.exId, to: alt } });
    }
  }
  return out;
}

/** Apply a change to a plan. Returns a new plan; exercise ids in logged history are never touched. */
export function applyChange(plan: Day[], ch: Change): Day[] {
  if (ch.t === 'replace') return plan.map((d) => (ch.dayIds && !ch.dayIds.includes(d.id) ? d : { ...d, ex: d.ex.map((e) => (e.exId === ch.from && !d.ex.some((x) => x.exId === ch.to) ? { ...e, exId: ch.to } : e)) }));
  if (ch.t === 'remove') return plan.map((d) => (d.id === ch.dayId ? { ...d, ex: d.ex.filter((e) => e.id !== ch.peId) } : d));
  return plan;
}
