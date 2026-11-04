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
    incrementLb: 5,  // smallest common jump for most barbells and machines. Dumbbells often jump 5 lb per hand; per-exercise steps are a later feature.
  },
  /** Default rest by top of rep range. Lifter can adjust per timer. */
  restSeconds: { heavy: 180, moderate: 120, light: 90, heavyMaxReps: 6, moderateMaxReps: 10 },
  /** Rough session-length estimate shown before a workout. Labeled "about", never used for scoring. */
  durationEstimate: { secondsPerSetWork: 40 },
} as const;

export const SWAP_REASONS = [
  { id: 'equipment', label: 'Equipment busy or missing' },
  { id: 'prefer', label: 'I prefer another exercise' },
  { id: 'comfort', label: "I'm not comfortable doing it" },
  { id: 'today', label: 'Just changing it today' },
] as const;
export type SwapReason = typeof SWAP_REASONS[number]['id'];
