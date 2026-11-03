// Comfort-aware starter plans for the real app. Plain lookup tables, no scoring.
// The user's answer only picks which version of each exercise a starter plan begins with. Every exercise stays available to swap in later.
// Names below are the exact library names (RepDB free tier, imported) so they resolve without guessing.
import type { PlanTemplate } from './templates';

export type Comfort = 'machines' | 'mixed' | 'all' | 'unsure';
type Level = 1 | 2 | 3; // 1 machines and cables, 2 dumbbells and bodyweight, 3 barbells and hanging bodyweight

/** "Not sure" starts with machines and dumbbells. Barbells only when the user chooses them. */
export const comfortLevel = (c: Comfort): Level => (c === 'machines' ? 1 : c === 'all' ? 3 : 2);

export const LEVEL: Record<string, Level> = {
  // template names
  'Barbell Bench Press': 3, 'Incline Barbell Bench Press': 3, 'Overhead Press': 3, 'Barbell Row': 3, 'Barbell Back Squat': 3, 'Romanian Deadlift': 3, 'Pull Up': 3, 'Barbell Curl': 3, 'Skull Crusher': 3,
  'Incline Dumbbell Press': 2, 'Dumbbell Curl': 2, 'Hammer Curl': 2, 'Dumbbell Fly': 2, 'Lateral Raise': 2, Plank: 2,
  'Tricep Pushdown': 1, 'Leg Curl': 1, 'Lat Pulldown': 1, 'Leg Press': 1, 'Seated Cable Row': 1, 'Leg Extension': 1, 'Face Pull': 1, 'Standing Calf Raise': 1,
  // replacements
  'Dumbbell Shoulder Press': 2, 'Dumbbell Bench Press': 2, 'Dumbbell Romanian Deadlift': 2, 'Single-Arm Dumbbell Row': 2, 'Dumbbell Goblet Squat': 2,
  'Machine Shoulder Press': 1, 'Machine Chest Press': 1, 'Machine Back Extension': 1, 'Chest-Supported Machine Row': 1, 'Hack Squat': 1, 'Close Grip Lat Pulldown': 1,
  'Cable Chest Press': 1, 'Cable Curl': 1, 'Cable Hammer Curl': 1, 'Cable Fly': 1, 'Cable Lateral Raise': 1, 'Cable Crunch': 1, 'Cable Tricep Pushdown': 1,
};

/** Ordered options per exercise, per target level. First one not already in the workout wins. */
const SWAP: Record<string, { 2?: string[]; 1?: string[] }> = {
  'Barbell Bench Press': { 2: ['Dumbbell Bench Press'], 1: ['Machine Chest Press'] },
  'Incline Barbell Bench Press': { 2: ['Incline Dumbbell Press'], 1: ['Cable Chest Press', 'Cable Fly'] },
  'Overhead Press': { 2: ['Dumbbell Shoulder Press'], 1: ['Machine Shoulder Press'] },
  'Barbell Row': { 2: ['Single-Arm Dumbbell Row'], 1: ['Chest-Supported Machine Row'] },
  'Barbell Back Squat': { 2: ['Dumbbell Goblet Squat'], 1: ['Leg Press', 'Hack Squat'] },
  'Romanian Deadlift': { 2: ['Dumbbell Romanian Deadlift'], 1: ['Machine Back Extension'] },
  'Pull Up': { 2: ['Lat Pulldown', 'Close Grip Lat Pulldown'], 1: ['Lat Pulldown', 'Close Grip Lat Pulldown'] },
  'Barbell Curl': { 2: ['Dumbbell Curl'], 1: ['Cable Curl'] },
  'Skull Crusher': { 2: ['Tricep Pushdown'], 1: ['Tricep Pushdown', 'Cable Tricep Pushdown'] },
  'Incline Dumbbell Press': { 1: ['Cable Chest Press', 'Cable Fly'] },
  'Dumbbell Curl': { 1: ['Cable Curl'] }, 'Hammer Curl': { 1: ['Cable Hammer Curl'] }, 'Dumbbell Fly': { 1: ['Cable Fly'] },
  'Lateral Raise': { 1: ['Cable Lateral Raise'] }, Plank: { 1: ['Cable Crunch'] },
};

export type Adapted = { tpl: PlanTemplate; swapped: Record<string, string>; notes: string[] };

export function applyComfort(tpl: PlanTemplate, comfort: Comfort): Adapted {
  const level = comfortLevel(comfort); const swapped: Record<string, string> = {}; let kept = 0;
  const days = tpl.days.map(d => {
    const taken = new Set(d.exercises.filter(e => (LEVEL[e[0]] ?? 1) <= level).map(e => e[0]));
    const out: typeof d.exercises = [];
    for (const e of d.exercises) {
      if ((LEVEL[e[0]] ?? 1) <= level) { out.push(e); continue; }
      const pick = (SWAP[e[0]]?.[level as 1 | 2] ?? []).find(n => !taken.has(n));
      if (pick) { taken.add(pick); swapped[pick] = e[0]; out.push([pick, e[1], e[2], e[3]]); }
      else if (d.exercises.length > 3) { /* no allowed option and the day can spare it: leave it out */ }
      else { kept++; out.push(e); }
    }
    return { ...d, exercises: out };
  });
  const notes: string[] = [];
  if (level < 3) notes.push(level === 1 ? 'You chose mostly machines, so barbell lifts start as machine or cable versions.' : 'Barbell lifts start as dumbbell or machine versions. You can add barbells any time.');
  if (comfort === 'unsure') notes.push('You were not sure, so we started with machines and dumbbells.');
  if (kept) notes.push('A few exercises had no easier version, so they are kept. Swap them if you like.');
  return { tpl: { ...tpl, days }, swapped, notes };
}
