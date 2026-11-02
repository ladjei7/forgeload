import type { Day, Hist, LibEx, PlanEx, Target } from './data';

export type Screen = 'onboard' | 'review' | 'home' | 'plan' | 'workout' | 'progress' | 'library' | 'complete';
export type Net = 'online' | 'slow' | 'fail' | 'offline';
export type SetStatus = 'saving' | 'saved' | 'failed' | 'queued';
export type SetLog = { id: string; peId: string; n: number; w: number; r: number; status: SetStatus };
export type WEx = PlanEx & { extra: number };
export type Draft = { w: string; r: string };
export type Workout = {
  dayId: string; dayIdx: number; startedAt: number; exs: WEx[]; idx: number; sets: SetLog[];
  ovr: Record<string, { w: number; r: number }>; draft: Record<string, Draft>; restEnd: number | null; restLen: number;
};
export type Answers = { days: number; exp: string; goal: string; time: number; equip: string };
export type Summary = {
  dayName: string; logged: number; planned: number; skipped: number; volume: number; minutes: number;
  highs: string[]; next: { name: string; text: string }[]; nextDayName: string; nextPos: number; total: number; unsynced: number;
};
export type SheetState = { t: string; a?: string; b?: string; n?: number } | null;
export type PlanSave = 'saved' | 'saving' | 'failed' | 'offline';

export type State = {
  screen: Screen; back: boolean;
  plan: Day[]; hist: Hist; nextDay: number; lastDay: number | null; weekDone: boolean[]; today: number;
  workout: Workout | null; net: Net; theme: 'dark' | 'light'; mode: 'list' | 'focus';
  fav: string[]; recent: string[]; custom: LibEx[]; planSave: PlanSave; selDay: number; exp: string | null;
  summary: Summary | null; ob: { step: number; a: Answers }; draftPlan: Day[] | null;
  sheet: SheetState; toast: { msg: string; undo?: boolean } | null; fresh: boolean;
};

export type Ctx = {
  s: State;
  lib: LibEx[];
  now: number;
  go: (screen: Screen) => void;
  set: (p: Partial<State>) => void;
  open: (t: string, extra?: { a?: string; b?: string; n?: number }) => void;
  close: () => void;
  toast: (msg: string, undo?: boolean) => void;
  targetOf: (pe: PlanEx) => Target;
  startWorkout: (dayIdx: number) => void;
  logSet: (peId: string) => void;
  retrySet: (id: string) => void;
  editDraft: (peId: string, p: Partial<Draft>) => void;
  stepDraft: (peId: string, field: 'w' | 'r', dir: 1 | -1, step: number) => void;
  finish: (force?: boolean) => void;
  mutatePlan: (fn: (d: Day[]) => Day[]) => void;
  retryPlanSave: () => void;
  acts: number;
};
