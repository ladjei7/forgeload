// Starter-plan recommendation from the onboarding answers. Plain rules, no hidden scoring, and the
// reasoning is returned in words so the person can see why. These are common starting points,
// not a claim that one split beats another.

/** brand_new: never trained. new: beginner. some: intermediate. experienced: advanced. */
export type Experience = 'brand_new' | 'new' | 'some' | 'experienced';
const isNew = (e: Experience) => e === 'new' || e === 'brand_new';
export type Rec = { primary: string; alternatives: string[]; why: string };

export function recommendPlan(daysPerWeek: number, experience: Experience): Rec {
  const d = Math.min(6, Math.max(1, Math.round(daysPerWeek)));

  if (d === 1) {
    return {
      primary: 'fbeod', alternatives: [],
      why: 'With 1 day a week, a full body workout trains everything each time. The plan rotates through 3 workouts, so each week you pick up where you left off.',
    };
  }

  if (d <= 3) {
    return {
      primary: 'fbeod',
      alternatives: d === 3 && !isNew(experience) ? ['ul2'] : [],
      why: d === 2
        ? 'With 2 days a week, training your whole body each session gives every muscle regular work. The plan has 3 workouts and just continues where you left off, so you are never behind.'
        : 'With 3 days a week, a full body workout each time trains every muscle several times a week with rest days between.',
    };
  }
  if (d === 4) {
    return {
      primary: 'ul2',
      alternatives: ['ap'],
      why: 'Four days fits an upper/lower split well: each muscle gets trained twice a week with a day or two to recover. Anterior/posterior is a similar alternative.',
    };
  }
  if (d === 5) {
    return isNew(experience)
      ? { primary: 'ul2', alternatives: ['ppl-ul'], why: 'You can train 5 days, but newer lifters often do well starting with 4 and adding a day once recovery feels easy. The 5 day plan is listed if you want it now.' }
      : { primary: 'ppl-ul', alternatives: ['ul2'], why: 'Five days: push, pull and legs, then upper and lower. Most muscles get about two hits a week.' };
  }
  return isNew(experience)
    ? { primary: 'ul2', alternatives: ['ppl'], why: 'Six days a week is a lot to start with. Newer lifters usually progress well on 4 days and recover better. The 6 day plan is listed if you want it anyway.' }
    : { primary: 'ppl', alternatives: ['ppl-arnold'], why: 'Six days: push, pull, legs, repeated twice a week. A good fit if you recover well and can be consistent.' };
}

// ---- Tailoring: the goal and session length change the plan itself ----
import type { PlanTemplate } from './templates';

/** fat_loss: lose fat while keeping or building muscle. fitness: general fitness. 'both' is kept for older saved answers. */
export type Goal = 'muscle' | 'strength' | 'fat_loss' | 'fitness' | 'both';
/** 25 = 20-30 min, 40 = 30-45, 55 = 45-60, 75 = more than 60. 45, 60, 90 are older saved answers. */
export type Minutes = 25 | 40 | 55 | 75 | 45 | 60 | 90;

export const GOAL_NOTE: Record<Goal, string> = {
  muscle: 'Moderate rep ranges (about 6 to 15) across the board, the usual choice for building muscle.',
  strength: 'Your first two lifts each day move to heavier 4 to 6 rep ranges. Everything else stays moderate.',
  both: 'Your first lift each day moves to a heavier 5 to 8 rep range. Everything else stays moderate.',
  fat_loss: 'Moderate rep ranges, the same as for building muscle. Lifting helps you keep muscle while you lose fat; your eating does most of the fat loss.',
  fitness: 'Moderate to higher reps (about 8 to 15) so sessions build strength and work capacity without very heavy sets.',
};
export const TIME_NOTE: Record<Minutes, string> = {
  25: 'Short sessions: 3 exercises a day, so each workout fits in about 20 to 30 minutes.',
  40: '4 exercises a day, about 30 to 45 minutes.',
  55: 'The full plan, about 45 to 60 minutes.',
  75: 'The full plan, with plenty of rest between sets.',
  45: 'Short sessions: 4 exercises a day, so each workout fits in roughly 45 minutes.',
  60: 'The standard 5 exercises a day, roughly an hour.',
  90: 'All the exercises in each workout, with plenty of rest between sets.',
};

export function tailorTemplate(tpl: PlanTemplate, goal: Goal, minutes: Minutes): PlanTemplate {
  return {
    ...tpl,
    days: tpl.days.map(d => {
      let ex = d.exercises.map(e => [...e] as typeof e);
      if (goal === 'strength') ex = ex.map((e, i) => (i < 2 ? [e[0], e[1], 4, 6] : e));
      if (goal === 'both') ex = ex.map((e, i) => (i < 1 ? [e[0], e[1], 5, 8] : e));
      if (goal === 'fitness') ex = ex.map(e => [e[0], e[1], Math.max(8, e[2]), Math.max(15, Math.max(8, e[2]) + 4)] as typeof e);
      if (minutes === 25) ex = ex.slice(0, 3);
      if (minutes === 40 || minutes === 45) ex = ex.slice(0, 4);
      return { ...d, exercises: ex };
    }),
  };
}
