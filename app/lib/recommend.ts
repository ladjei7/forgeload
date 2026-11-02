// Starter-plan recommendation from two answers. Plain rules, no hidden scoring, and the
// reasoning is returned in words so the person can see why. These are common starting points,
// not a claim that one split beats another.

export type Experience = 'new' | 'some' | 'experienced';
export type Rec = { primary: string; alternatives: string[]; why: string };

export function recommendPlan(daysPerWeek: number, experience: Experience): Rec {
  const d = Math.min(6, Math.max(2, Math.round(daysPerWeek)));

  if (d <= 3) {
    return {
      primary: 'fbeod',
      alternatives: d === 3 && experience !== 'new' ? ['ul2'] : [],
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
    return experience === 'new'
      ? { primary: 'ul2', alternatives: ['ppl-ul'], why: 'You can train 5 days, but newer lifters often do well starting with 4 and adding a day once recovery feels easy. The 5 day plan is listed if you want it now.' }
      : { primary: 'ppl-ul', alternatives: ['ul2'], why: 'Five days: push, pull and legs, then upper and lower. Most muscles get about two hits a week.' };
  }
  return experience === 'new'
    ? { primary: 'ul2', alternatives: ['ppl'], why: 'Six days a week is a lot to start with. Newer lifters usually progress well on 4 days and recover better. The 6 day plan is listed if you want it anyway.' }
    : { primary: 'ppl', alternatives: ['ppl-arnold'], why: 'Six days: push, pull, legs, repeated twice a week. A good fit if you recover well and can be consistent.' };
}

// ---- Tailoring: the goal and session length change the plan itself ----
import type { PlanTemplate } from './templates';

export type Goal = 'muscle' | 'strength' | 'both';
export type Minutes = 45 | 60 | 90;

export const GOAL_NOTE: Record<Goal, string> = {
  muscle: 'Moderate rep ranges (about 6 to 15) across the board, the usual choice for building muscle.',
  strength: 'Your first two lifts each day move to heavier 4 to 6 rep ranges. Everything else stays moderate.',
  both: 'Your first lift each day moves to a heavier 5 to 8 rep range. Everything else stays moderate.',
};
export const TIME_NOTE: Record<Minutes, string> = {
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
      if (minutes === 45) ex = ex.slice(0, 4);
      return { ...d, exercises: ex };
    }),
  };
}
