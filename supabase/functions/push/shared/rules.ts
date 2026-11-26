// Every tunable number in Forgeload's recommendation rules lives here, with the reason it was chosen.
// These are starting hypotheses, not findings. Change them here and the tests show what moves.

export const RULES = {
  /** Free: "make this swap your default?" */
  swapSuggestion: {
    windowDays: 30,  // only recent behavior counts
    threshold: 3,    // 2 could be coincidence (busy gym twice); 3 looks like a habit. Revisit with beta data.
    /** Swap reasons that say nothing about preference, so they never count toward the suggestion. */
    ignoredReasons: ['equipment', 'today'] as readonly string[],
  },
  /** Basic (free) double progression. */
  progression: {
    incrementLb: 5,  // fallback step when nothing is known about the equipment
    /**
     * Reps added per session while holding a weight: one rep, on the set that needs it most (the lowest;
     * on a tie, the earliest). Sets already done are kept as the floor, so a strong session is never asked
     * to do less. A heuristic: small, reachable steps; people who beat it simply log more.
     */
    repsAddedPerSession: 1,
    /** Timed holds move in 5-second steps; one second is not a meaningful target. */
    secondsAddedPerSession: 5,
    /** Sessions in a row under the bottom of the range, at the same weight, before a lighter option is offered. One bad day never triggers it. */
    belowMinSessions: 3,
    /** A weight step bigger than this share of the current weight gets a heads-up (e.g. 15 to 20 lb is +33%). */
    bigJumpRatio: 0.1,
    /** Past sessions the engine looks at (newest first). The target itself builds on the latest one. */
    historyWindow: 6,
  },
  /**
   * Default weight steps by equipment, as {lb, kg}. Practical assumptions, editable per exercise:
   * plates go 2.5 lb / 1.25 kg per side; dumbbell racks usually 5 lb or 2-2.5 kg; selectorized stacks
   * (machines, most cables) 10 lb / 5 kg plates. Dumbbells and kettlebells are per implement.
   */
  steps: {
    Barbell: { lb: 5, kg: 2.5 }, 'Smith Machine': { lb: 5, kg: 2.5 }, Plate: { lb: 5, kg: 2.5 },
    Dumbbell: { lb: 5, kg: 2.5 }, Kettlebell: { lb: 5, kg: 4 },
    Machine: { lb: 10, kg: 5 }, Cable: { lb: 10, kg: 5 },
    Bodyweight: { lb: 5, kg: 2.5 }, // added weight on a belt or vest
    default: { lb: 5, kg: 2.5 },
  } as Record<string, { lb: number; kg: number }>,
  /** Default rest by top of rep range. Lifter can adjust per timer. */
  restSeconds: { heavy: 180, moderate: 120, light: 90, heavyMaxReps: 6, moderateMaxReps: 10 },
  /**
   * Isolation moves (curls, raises, extensions) recover faster than heavy compounds, so they cap lower:
   * 120 s for heavy sets, otherwise 90 s. Over about 60-90 s shows no clear extra benefit for growth
   * (Singer et al. 2024). Timed holds: 75 s. All editable per exercise and per timer.
   */
  restIsolation: { heavy: 120, other: 90 },
  restBodyweight: 75,
  /** Rough session-length estimate shown before a workout. Labeled "about", never used for scoring. */
  durationEstimate: {
    secondsPerSetWork: 40,
    secondsSetupPerExercise: 60, // walking to the station, setting the weight
    secondsWarmup: 180,          // a couple of light sets before the first lift
  },
  /** What each session-length answer aims for, in estimated minutes (warm-up included). */
  sessionTargets: { 25: [20, 30], 40: [30, 45], 55: [45, 60], 75: [60, 80], 45: [35, 45], 60: [50, 65], 90: [70, 95] } as Record<number, readonly [number, number]>,
  /** Most working sets per exercise when filling a longer session. */
  maxSetsPerExercise: 5,
  /**
   * "Steady lately" (Pro, planned): stalled only when the last 3 eligible sessions of an exercise
   * show no progress from each one to the next. 3 is the smallest window that isn't a single off
   * day; with double progression a lifter normally gains a rep somewhere within two sessions.
   */
  stall: { sessions: 3 },
  /**
   * Notifications (all opt-in).
   * defaultReminderTime: early evening, when most people train after work.
   * dueWindowMinutes: the reminder job runs every 5 minutes; a 60-minute window means a missed run or
   *   a slow server doesn't lose the day's message, and the send log keeps it to one.
   * comebackDays / comebackMax: one friendly message after a week without training, one follow-up a
   *   week later, then silence until they train again (more than that reads as nagging).
   * restMaxLateSeconds: a "Rest complete" arriving 30 s late would land mid-set, so it is dropped.
   * restEarlyMs: alerts may go out up to 300 ms early to absorb network time.
   */
  push: { defaultReminderTime: '17:00', dueWindowMinutes: 60, comebackDays: 7, comebackMax: 2, restMaxLateSeconds: 20, restEarlyMs: 300 },
  /**
   * Newer lifters: at most 4 sets per exercise and 20 working sets per session, even when they pick
   * a long session. Early progress comes from practice, and recovery is the limit; 20 sets is the top
   * of the usual beginner range. The extra time becomes longer rests, not more sets.
   */
  newer: { maxSetsPerExercise: 4, maxSessionSets: 20 },
} as const;

export const SWAP_REASONS = [
  { id: 'equipment', label: 'Equipment busy or missing' },
  { id: 'prefer', label: 'I prefer another exercise' },
  { id: 'comfort', label: "I'm not comfortable doing it" },
  { id: 'today', label: 'Just changing it today' },
] as const;
export type SwapReason = typeof SWAP_REASONS[number]['id'];
