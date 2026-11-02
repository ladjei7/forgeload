# Design preview: rationale (round 2)

Route: `/design-preview` on branch `design-exploration`. Mock data only. No Supabase reads or writes, no production screens changed.
Two tiny compatibility edits outside the preview folder: `AuthGate.tsx` and `BottomNav.tsx` skip the `/design-preview` path so the preview works without a session and without the old tab bar. Everything else is new files.

## Direction
Precision Forge is the base (graphite, hairlines, ember on the one next action, teal for progress only). From Chalk Ledger it takes the **target block**: a large number with a plain-language reason directly under the exercise name. From Daylight Lab it takes an **optional light theme** (paper and ink). The light accent is a darkened ember (#BF360C, 5.1:1 on paper) instead of cobalt, so the brand stays one color in both themes.

## What the preview tests
| Your ask | What is in the prototype |
|---|---|
| 1. Identity | An F whose top arm becomes an up-right arrow. It appears only where progress is announced: the +5 lb chip on a target, the workout-complete screen, onboarding and plan review, empty states. It is not decoration elsewhere. The existing logo is untouched (the wordmark text is a stand-in). |
| 2. Logger | One tap logs a set at target (inputs are prefilled; the next set repeats the last values). One check only: the Log button. Saved sets show a filled number badge, not a second checkmark. "Last time" is small and muted; "Target" is large and ember. |
| 3. Progression | Target, one-sentence headline, expandable "Why this target", and **Change target** (override, this workout only, with the recommendation still shown). Text and numbers come from the same function, so they cannot disagree. |
| 4. Plan editor | Rows say "Edit" with a chevron and show the prescription. Steppers, up/down buttons (no drag-only), replace, remove with Undo. Rotation: make any day next, move earlier/later, add a workout. Save chip: Saved, Saving, Not saved (Retry), Offline (saved on device). |
| 5. Consistent data | Counts, sets, minutes, week dots, rotation position and next-time targets are all derived from one plan and one history (see `data.ts`, 10 unit tests). Edge cases: top of range (weight up), one set under range (hold), bodyweight, first time, mixed set results. |
| 6. Phones | 44 px+ targets, 56 px Log button, primary action in the bottom dock (thumb zone), keyboard hides the dock, `inputMode` decimal/numeric, sheets with Escape and focus return, safe-area insets, reduced motion honored. Verified at 320, 390, 430 and 1280 px: no horizontal overflow. |
| 7. Missing flows | 4-question onboarding, generated plan review (swap per exercise), library (search, muscle/equipment, tabs, favorites), custom exercise create (validation), substitution (workout-only or plan), workout complete. |
| 8. Signature experience | List logger vs Focus logger, switchable in one tap, so you can compare on a phone. |
| 9. Validation | Network panel: Online, Slow, Next save fails, Offline. Interrupted-workout scenario. Incomplete finish. Tap counter. Plan in `usability-test-plan.md`. |
| 10. Isolation | Branch only, not merged, no production data. |

## List vs Focus: my current read (not a verdict)
- **List** shows the whole exercise at once, good for people who edit freely and like seeing all sets. Costs vertical space and has 5 narrow columns.
- **Focus** puts one set in the thumb zone with big steppers and a Log button that states what it will log ("Log set 2: 135 x 8"). Fewer decisions per set; hides future sets behind the dot rail.
- Hypothesis to test: Focus wins for beginners and for gym use with one hand; List wins for experienced lifters who change weights every set. If true, default by onboarding answer and keep both.

## Interaction counts (instrumented where noted)
| Task | Taps |
|---|---|
| Log a set at target | **1** (measured, both loggers) |
| Log a set with different reps | List: tap field + keypad + Log. Focus: + or - then Log (2) |
| Next exercise | 1 |
| Start the workout from Home | 1 |
| Finish after all sets logged | 1 (last exercise) |
| Swap an exercise | 2 (Swap, choose) |
| Change target | 4+ (Why, Change target, steppers, Use). Probably too buried: test it |
| Plan: change sets on an exercise | 2 (Edit, +/-), autosaves |
| Onboarding to a created plan | 9 (4 answers, 4 Continue or Build, 1 Create plan). Test auto-advance |

## Risks I can see and did or did not handle
- Double-tap logs two sets: 500 ms guard added; Edit can remove a set. Handled in the preview, needs real-device test.
- Typo weight (1350): not handled. Needs a sanity warning.
- Finish with all sets logged is one tap with no confirmation: intentional, but test for accidental taps.
- Failed or queued sets block nothing; Finish warns and offers Retry. In production, saves must be durable on the device first (local queue). The preview only simulates this.
- Preview limits: no real photos (licensed RepDB images come later), no real keyboard (desktop and emulated phone only), timers use the real clock, mock library has 24 exercises.
