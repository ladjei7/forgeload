// Starter plan templates. Each exercise is [name, sets, minReps, maxReps].
// Names are matched against the exercise library when a template is applied,
// so they land as the library's exact names when possible.

export type TemplateEx = [name: string, sets: number, repMin: number, repMax: number];
/** `beginner`: the version for newer lifters (same main lifts as workout A, different accessories). */
export type TemplateDay = { name: string; exercises: TemplateEx[]; beginner?: TemplateEx[] };
export type PlanTemplate = { id: string; name: string; blurb: string; days: TemplateDay[] };

const PUSH: TemplateEx[] = [
  ['Barbell Bench Press', 3, 6, 10],
  ['Incline Dumbbell Press', 3, 8, 12],
  ['Overhead Press', 3, 6, 10],
  ['Lateral Raise', 3, 12, 20],
  ['Tricep Pushdown', 3, 10, 15],
];
const PULL: TemplateEx[] = [
  ['Pull Up', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Lat Pulldown', 3, 8, 12],
  ['Face Pull', 3, 12, 20],
  ['Dumbbell Curl', 3, 10, 15],
];
const LEGS: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Romanian Deadlift', 3, 6, 10],
  ['Leg Press', 3, 8, 12],
  ['Leg Curl', 3, 10, 15],
  ['Standing Calf Raise', 4, 10, 15],
];
const UPPER: TemplateEx[] = [
  ['Barbell Bench Press', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Overhead Press', 3, 8, 12],
  ['Lat Pulldown', 3, 8, 12],
  ['Dumbbell Curl', 2, 10, 15],
  ['Tricep Pushdown', 2, 10, 15],
];
const LOWER: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Romanian Deadlift', 3, 6, 10],
  ['Leg Press', 3, 8, 12],
  ['Leg Curl', 3, 10, 15],
  ['Standing Calf Raise', 3, 10, 15],
];
const FULL: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Barbell Bench Press', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Overhead Press', 2, 8, 12],
  ['Romanian Deadlift', 2, 8, 12],
  ['Plank', 2, 30, 60],
];
const ANTERIOR: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Barbell Bench Press', 3, 6, 10],
  ['Overhead Press', 3, 8, 12],
  ['Leg Extension', 3, 10, 15],
  ['Tricep Pushdown', 3, 10, 15],
];
const POSTERIOR: TemplateEx[] = [
  ['Romanian Deadlift', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Lat Pulldown', 3, 8, 12],
  ['Leg Curl', 3, 10, 15],
  ['Dumbbell Curl', 3, 10, 15],
];

// Second and third workouts. Lettered workouts are different on purpose: same muscles, other
// exercises. Beginners keep A's main lifts (practice makes progress) and change the rest.
const PUSH_B: TemplateEx[] = [
  ['Incline Barbell Bench Press', 3, 6, 10],
  ['Dumbbell Bench Press', 3, 8, 12],
  ['Dumbbell Shoulder Press', 3, 8, 12],
  ['Cable Lateral Raise', 3, 12, 20],
  ['Skull Crusher', 3, 10, 15],
];
const PUSH_B_NEW: TemplateEx[] = [
  ['Barbell Bench Press', 3, 6, 10],
  ['Incline Dumbbell Press', 3, 8, 12],
  ['Dumbbell Fly', 3, 10, 15],
  ['Dumbbell Shoulder Press', 3, 8, 12],
  ['Cable Tricep Pushdown', 3, 10, 15],
];
const PULL_B: TemplateEx[] = [
  ['Barbell Row', 3, 6, 10],
  ['Close Grip Lat Pulldown', 3, 8, 12],
  ['Seated Cable Row', 3, 8, 12],
  ['Face Pull', 3, 12, 20],
  ['Hammer Curl', 3, 10, 15],
];
const PULL_B_NEW: TemplateEx[] = [
  ['Pull Up', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Seated Cable Row', 3, 8, 12],
  ['Face Pull', 3, 12, 20],
  ['Hammer Curl', 3, 10, 15],
];
const LEGS_B: TemplateEx[] = [
  ['Romanian Deadlift', 3, 6, 10],
  ['Hack Squat', 3, 8, 12],
  ['Dumbbell Lunge', 3, 8, 12],
  ['Leg Extension', 3, 10, 15],
  ['Standing Calf Raise', 4, 10, 15],
];
const LEGS_B_NEW: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Romanian Deadlift', 3, 6, 10],
  ['Dumbbell Lunge', 3, 8, 12],
  ['Leg Extension', 3, 10, 15],
  ['Standing Calf Raise', 4, 10, 15],
];
const UPPER_B: TemplateEx[] = [
  ['Incline Dumbbell Press', 3, 6, 10],
  ['Seated Cable Row', 3, 8, 12],
  ['Dumbbell Shoulder Press', 3, 8, 12],
  ['Pull Up', 3, 6, 10],
  ['Hammer Curl', 2, 10, 15],
  ['Skull Crusher', 2, 10, 15],
];
const UPPER_B_NEW: TemplateEx[] = [
  ['Barbell Bench Press', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Close Grip Lat Pulldown', 3, 8, 12],
  ['Dumbbell Shoulder Press', 3, 8, 12],
  ['Hammer Curl', 2, 10, 15],
  ['Cable Tricep Pushdown', 2, 10, 15],
];
const LOWER_B: TemplateEx[] = [
  ['Romanian Deadlift', 3, 6, 10],
  ['Hack Squat', 3, 8, 12],
  ['Dumbbell Lunge', 3, 8, 12],
  ['Leg Extension', 3, 10, 15],
  ['Standing Calf Raise', 3, 10, 15],
];
const LOWER_B_NEW: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Romanian Deadlift', 3, 6, 10],
  ['Dumbbell Lunge', 3, 8, 12],
  ['Leg Extension', 3, 10, 15],
  ['Standing Calf Raise', 3, 10, 15],
];
const FULL_B: TemplateEx[] = [
  ['Romanian Deadlift', 3, 6, 10],
  ['Incline Dumbbell Press', 3, 8, 12],
  ['Lat Pulldown', 3, 8, 12],
  ['Dumbbell Lunge', 2, 8, 12],
  ['Lateral Raise', 2, 12, 15],
  ['Cable Crunch', 2, 10, 15],
];
const FULL_B_NEW: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Barbell Bench Press', 3, 6, 10],
  ['Lat Pulldown', 3, 8, 12],
  ['Romanian Deadlift', 2, 8, 12],
  ['Lateral Raise', 2, 12, 15],
  ['Plank', 2, 30, 60],
];
const FULL_C: TemplateEx[] = [
  ['Leg Press', 3, 8, 12],
  ['Dumbbell Bench Press', 3, 8, 12],
  ['Seated Cable Row', 3, 8, 12],
  ['Dumbbell Shoulder Press', 2, 8, 12],
  ['Leg Curl', 2, 10, 15],
  ['Plank', 2, 30, 60],
];
const FULL_C_NEW: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Barbell Bench Press', 3, 6, 10],
  ['Seated Cable Row', 3, 8, 12],
  ['Leg Curl', 2, 10, 15],
  ['Dumbbell Shoulder Press', 2, 8, 12],
  ['Plank', 2, 30, 60],
];
const ANTERIOR_B: TemplateEx[] = [
  ['Hack Squat', 3, 8, 12],
  ['Incline Dumbbell Press', 3, 8, 12],
  ['Dumbbell Shoulder Press', 3, 8, 12],
  ['Dumbbell Lunge', 3, 8, 12],
  ['Skull Crusher', 3, 10, 15],
];
const ANTERIOR_B_NEW: TemplateEx[] = [
  ['Barbell Back Squat', 3, 5, 8],
  ['Barbell Bench Press', 3, 6, 10],
  ['Dumbbell Lunge', 3, 8, 12],
  ['Dumbbell Shoulder Press', 3, 8, 12],
  ['Cable Tricep Pushdown', 3, 10, 15],
];
const POSTERIOR_B: TemplateEx[] = [
  ['Pull Up', 3, 6, 10],
  ['Dumbbell Romanian Deadlift', 3, 8, 12],
  ['Seated Cable Row', 3, 8, 12],
  ['Leg Curl', 3, 10, 15],
  ['Hammer Curl', 3, 10, 15],
];
const POSTERIOR_B_NEW: TemplateEx[] = [
  ['Romanian Deadlift', 3, 6, 10],
  ['Barbell Row', 3, 6, 10],
  ['Seated Cable Row', 3, 8, 12],
  ['Leg Curl', 3, 10, 15],
  ['Hammer Curl', 3, 10, 15],
];

export const TEMPLATES: PlanTemplate[] = [
  {
    id: 'ppl',
    name: 'Push Pull Legs (PPL)',
    blurb: '6 days. Push, Pull, Legs, run twice a week.',
    days: [
      { name: 'Push A', exercises: PUSH },
      { name: 'Pull A', exercises: PULL },
      { name: 'Legs A', exercises: LEGS },
      { name: 'Push B', exercises: PUSH_B, beginner: PUSH_B_NEW },
      { name: 'Pull B', exercises: PULL_B, beginner: PULL_B_NEW },
      { name: 'Legs B', exercises: LEGS_B, beginner: LEGS_B_NEW },
    ],
  },
  {
    id: 'fbeod',
    name: 'Full Body Every Other Day (FBEOD)',
    blurb: '3 days. Whole body each session, rest days between.',
    days: [
      { name: 'Full Body A', exercises: FULL },
      { name: 'Full Body B', exercises: FULL_B, beginner: FULL_B_NEW },
      { name: 'Full Body C', exercises: FULL_C, beginner: FULL_C_NEW },
    ],
  },
  {
    id: 'ul2',
    name: 'Upper/Lower x2',
    blurb: '4 days. Upper and lower, twice a week each.',
    days: [
      { name: 'Upper A', exercises: UPPER },
      { name: 'Lower A', exercises: LOWER },
      { name: 'Upper B', exercises: UPPER_B, beginner: UPPER_B_NEW },
      { name: 'Lower B', exercises: LOWER_B, beginner: LOWER_B_NEW },
    ],
  },
  {
    id: 'ap',
    name: 'Anterior/Posterior',
    blurb: '4 days. Front of the body, then the back, twice a week each.',
    days: [
      { name: 'Anterior A', exercises: ANTERIOR },
      { name: 'Posterior A', exercises: POSTERIOR },
      { name: 'Anterior B', exercises: ANTERIOR_B, beginner: ANTERIOR_B_NEW },
      { name: 'Posterior B', exercises: POSTERIOR_B, beginner: POSTERIOR_B_NEW },
    ],
  },
  {
    id: 'ppl-ul',
    name: 'PPL/UL',
    blurb: '5 days. Push, Pull, Legs, then Upper and Lower.',
    days: [
      { name: 'Push', exercises: PUSH },
      { name: 'Pull', exercises: PULL },
      { name: 'Legs', exercises: LEGS },
      { name: 'Upper', exercises: UPPER },
      { name: 'Lower', exercises: LOWER_B, beginner: LOWER_B_NEW },
    ],
  },
  {
    id: 'ppl-arnold',
    name: 'PPL/Arnold',
    blurb: '6 days. PPL, then an Arnold-style chest/back, shoulders/arms, legs.',
    days: [
      { name: 'Push', exercises: PUSH },
      { name: 'Pull', exercises: PULL },
      { name: 'Legs', exercises: LEGS },
      {
        name: 'Chest & Back',
        exercises: [
          ['Incline Barbell Bench Press', 4, 6, 10],
          ['Barbell Bench Press', 3, 6, 10],
          ['Pull Up', 4, 6, 10],
          ['Seated Cable Row', 3, 8, 12],
          ['Dumbbell Fly', 3, 10, 15],
        ],
      },
      {
        name: 'Shoulders & Arms',
        exercises: [
          ['Overhead Press', 4, 6, 10],
          ['Lateral Raise', 4, 12, 20],
          ['Barbell Curl', 3, 8, 12],
          ['Skull Crusher', 3, 8, 12],
          ['Hammer Curl', 3, 10, 15],
        ],
      },
      { name: 'Legs B', exercises: LEGS_B, beginner: LEGS_B_NEW },
    ],
  },
];

/** Newer lifters get each workout's beginner version where one exists. */
export function forExperience(tpl: PlanTemplate, experience: string): PlanTemplate {
  const newer = experience === 'new' || experience === 'brand_new';
  return { ...tpl, days: tpl.days.map(d => ({ name: d.name, exercises: newer && d.beginner ? d.beginner : d.exercises })) };
}

/** The template's blurb, reworded when the person trains on a different number of days than it has workouts. */
export function blurbFor(tpl: PlanTemplate, days: number): string {
  const m = tpl.blurb.match(/^(\d) days\. (.*)$/);
  if (!m || Number(m[1]) === days) return tpl.blurb;
  return `${tpl.days.length} workouts you rotate through, ${days} ${days === 1 ? 'day' : 'days'} a week. ${m[2]}`;
}
