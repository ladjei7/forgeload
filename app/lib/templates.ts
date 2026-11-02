// Starter plan templates. Each exercise is [name, sets, minReps, maxReps].
// Names are matched against the exercise library when a template is applied,
// so they land as the library's exact names when possible.

export type TemplateEx = [name: string, sets: number, repMin: number, repMax: number];
export type TemplateDay = { name: string; exercises: TemplateEx[] };
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

export const TEMPLATES: PlanTemplate[] = [
  {
    id: 'ppl',
    name: 'Push Pull Legs (PPL)',
    blurb: '6 days. Push, Pull, Legs, run twice a week.',
    days: [
      { name: 'Push A', exercises: PUSH },
      { name: 'Pull A', exercises: PULL },
      { name: 'Legs A', exercises: LEGS },
      { name: 'Push B', exercises: PUSH },
      { name: 'Pull B', exercises: PULL },
      { name: 'Legs B', exercises: LEGS },
    ],
  },
  {
    id: 'fbeod',
    name: 'Full Body Every Other Day (FBEOD)',
    blurb: '3 days. Whole body each session, rest days between.',
    days: [
      { name: 'Full Body A', exercises: FULL },
      { name: 'Full Body B', exercises: FULL },
      { name: 'Full Body C', exercises: FULL },
    ],
  },
  {
    id: 'ul2',
    name: 'Upper/Lower x2',
    blurb: '4 days. Upper and lower, twice a week each.',
    days: [
      { name: 'Upper A', exercises: UPPER },
      { name: 'Lower A', exercises: LOWER },
      { name: 'Upper B', exercises: UPPER },
      { name: 'Lower B', exercises: LOWER },
    ],
  },
  {
    id: 'ap',
    name: 'Anterior/Posterior',
    blurb: '4 days. Front of the body, then the back, twice a week each.',
    days: [
      { name: 'Anterior A', exercises: ANTERIOR },
      { name: 'Posterior A', exercises: POSTERIOR },
      { name: 'Anterior B', exercises: ANTERIOR },
      { name: 'Posterior B', exercises: POSTERIOR },
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
      { name: 'Lower', exercises: LOWER },
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
      { name: 'Legs B', exercises: LEGS },
    ],
  },
];
