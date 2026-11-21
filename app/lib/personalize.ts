// Starter-plan personalization beyond equipment comfort: areas to go easy on, and focus areas.
// Plain lookup tables, pure functions (unit tested). Runs after applyComfort, before the plan is saved.
// Names are template names or names already used by comfort.ts; all resolve to reviewed library exercises.
import type { PlanTemplate } from './templates';

export type Area = 'shoulders' | 'lower_back' | 'knees' | 'wrists' | 'elbows';
export type Focus = 'legs' | 'chest_back' | 'arms' | 'shoulders';

export const AREAS: { id: Area; title: string }[] = [
  { id: 'shoulders', title: 'Shoulders' }, { id: 'lower_back', title: 'Lower back' }, { id: 'knees', title: 'Knees' },
  { id: 'wrists', title: 'Wrists' }, { id: 'elbows', title: 'Elbows' },
];
export const FOCUSES: { id: Focus; title: string; sub: string }[] = [
  { id: 'legs', title: 'Legs and glutes', sub: 'Squats, presses, hinges, curls' },
  { id: 'chest_back', title: 'Chest and back', sub: 'Presses, rows, pulldowns' },
  { id: 'arms', title: 'Arms', sub: 'Biceps and triceps' },
  { id: 'shoulders', title: 'Shoulders', sub: 'Raises and presses' },
];

/** Which areas an exercise loads the most (conservative; only the clear cases). */
const LOADS: Record<string, Area[]> = {
  'Barbell Bench Press': ['shoulders', 'wrists'], 'Incline Barbell Bench Press': ['shoulders', 'wrists'],
  'Overhead Press': ['shoulders', 'lower_back'], 'Dumbbell Shoulder Press': ['shoulders'], 'Machine Shoulder Press': ['shoulders'],
  'Dumbbell Fly': ['shoulders'], 'Pull Up': ['shoulders', 'elbows'],
  'Barbell Row': ['lower_back'], 'Romanian Deadlift': ['lower_back'], 'Dumbbell Romanian Deadlift': ['lower_back'], 'Machine Back Extension': ['lower_back'],
  'Barbell Back Squat': ['knees', 'lower_back'], 'Dumbbell Goblet Squat': ['knees'], 'Hack Squat': ['knees'], 'Leg Extension': ['knees'],
  'Barbell Curl': ['wrists', 'elbows'], 'Skull Crusher': ['elbows', 'wrists'],
};

/** Gentler options, in order of preference. The first one that doesn't load a chosen area and isn't already in the workout wins. */
const GENTLER: Record<string, string[]> = {
  'Barbell Bench Press': ['Machine Chest Press', 'Cable Chest Press', 'Dumbbell Bench Press'],
  'Incline Barbell Bench Press': ['Cable Chest Press', 'Machine Chest Press', 'Incline Dumbbell Press'],
  'Overhead Press': ['Machine Shoulder Press', 'Cable Lateral Raise', 'Lateral Raise'],
  'Dumbbell Shoulder Press': ['Cable Lateral Raise', 'Lateral Raise'],
  'Machine Shoulder Press': ['Cable Lateral Raise', 'Lateral Raise'],
  'Dumbbell Fly': ['Cable Chest Press', 'Machine Chest Press'],
  'Pull Up': ['Lat Pulldown', 'Close Grip Lat Pulldown'],
  'Barbell Row': ['Chest-Supported Machine Row', 'Seated Cable Row'],
  'Romanian Deadlift': ['Leg Curl'], 'Dumbbell Romanian Deadlift': ['Leg Curl'], 'Machine Back Extension': ['Leg Curl', 'Cable Crunch'],
  'Barbell Back Squat': ['Leg Press', 'Leg Curl'], 'Dumbbell Goblet Squat': ['Leg Press', 'Leg Curl'], 'Hack Squat': ['Leg Press', 'Leg Curl'],
  'Leg Extension': ['Leg Curl'],
  'Barbell Curl': ['Hammer Curl', 'Cable Hammer Curl'], 'Skull Crusher': ['Tricep Pushdown', 'Cable Tricep Pushdown'],
};

/** Main muscle per exercise name used in plans (for focus areas). */
const MUSCLE: Record<string, string> = {
  'Barbell Bench Press': 'chest', 'Incline Barbell Bench Press': 'chest', 'Incline Dumbbell Press': 'chest', 'Dumbbell Bench Press': 'chest',
  'Machine Chest Press': 'chest', 'Cable Chest Press': 'chest', 'Dumbbell Fly': 'chest', 'Cable Fly': 'chest',
  'Barbell Row': 'back', 'Lat Pulldown': 'back', 'Close Grip Lat Pulldown': 'back', 'Seated Cable Row': 'back', 'Pull Up': 'back',
  'Chest-Supported Machine Row': 'back', 'Single-Arm Dumbbell Row': 'back',
  'Overhead Press': 'shoulders', 'Dumbbell Shoulder Press': 'shoulders', 'Machine Shoulder Press': 'shoulders', 'Lateral Raise': 'shoulders',
  'Cable Lateral Raise': 'shoulders', 'Face Pull': 'shoulders',
  'Barbell Curl': 'arms', 'Dumbbell Curl': 'arms', 'Hammer Curl': 'arms', 'Cable Curl': 'arms', 'Cable Hammer Curl': 'arms',
  'Tricep Pushdown': 'arms', 'Cable Tricep Pushdown': 'arms', 'Skull Crusher': 'arms',
  'Barbell Back Squat': 'legs', 'Dumbbell Goblet Squat': 'legs', 'Hack Squat': 'legs', 'Leg Press': 'legs', 'Leg Extension': 'legs',
  'Leg Curl': 'legs', 'Romanian Deadlift': 'legs', 'Dumbbell Romanian Deadlift': 'legs', 'Standing Calf Raise': 'legs',
};
const FOCUS_MUSCLES: Record<Focus, string[]> = { legs: ['legs'], chest_back: ['chest', 'back'], arms: ['arms'], shoulders: ['shoulders'] };

const loads = (name: string, areas: Area[]) => (LOADS[name] ?? []).some(a => areas.includes(a));

export type Personalized = { tpl: PlanTemplate; notes: string[]; swapped?: Record<string, string> };

/** Swap exercises that load a chosen area for gentler options. Never removes a workout's only exercises. */
export function applyAreas(tpl: PlanTemplate, areas: Area[]): Personalized {
  if (!areas.length) return { tpl, notes: [], swapped: {} };
  let swapped = 0, kept = 0; const map: Record<string, string> = {};
  const days = tpl.days.map(d => {
    const taken = new Set(d.exercises.filter(e => !loads(e[0], areas)).map(e => e[0]));
    const out: typeof d.exercises = [];
    for (const e of d.exercises) {
      if (!loads(e[0], areas)) { out.push(e); continue; }
      const pick = (GENTLER[e[0]] ?? []).find(n => !loads(n, areas) && !taken.has(n));
      if (pick) { taken.add(pick); swapped++; map[pick] = e[0]; out.push([pick, e[1], e[2], e[3]]); }
      else if (d.exercises.length > 3) { /* no gentler option left and the workout can spare it */ }
      else { kept++; out.push(e); }
    }
    return { ...d, exercises: out };
  });
  const names = AREAS.filter(a => areas.includes(a.id)).map(a => a.title.toLowerCase());
  const list = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const notes = [`Because you mentioned your ${list}, ${swapped ? 'exercises that load them most start as gentler versions' : 'we kept an eye on exercises that load them'}.`];
  if (kept) notes.push('A few had no gentler option, so they are kept. Go light, and swap them if they bother you.');
  notes.push("This isn't medical advice. If something hurts (not just effort), stop and swap it, and see a professional if pain continues.");
  return { tpl: { ...tpl, days }, notes, swapped: map };
}

/** One extra set for exercises in the focus areas, at most 2 extra sets per workout and 5 sets per exercise. */
export function applyFocus(tpl: PlanTemplate, focus: Focus[]): Personalized {
  const muscles = new Set(focus.slice(0, 2).flatMap(f => FOCUS_MUSCLES[f]));
  if (!muscles.size) return { tpl, notes: [] };
  let any = false;
  const days = tpl.days.map(d => {
    let extra = 0;
    const exercises = d.exercises.map(e => {
      if (extra < 2 && muscles.has(MUSCLE[e[0]] ?? '') && e[1] < 5) { extra++; any = true; return [e[0], e[1] + 1, e[2], e[3]] as typeof e; }
      return e;
    });
    return { ...d, exercises };
  });
  const names = FOCUSES.filter(f => focus.includes(f.id)).map(f => f.title.toLowerCase());
  return { tpl: { ...tpl, days }, notes: any ? [`More work for ${names.length === 2 ? `${names[0]}, plus ${names[1]}` : names[0]}: an extra set on those exercises, up to 2 per workout.`] : [] };
}
