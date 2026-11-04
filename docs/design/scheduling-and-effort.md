# Flexible scheduling and effort tracking

Status 2026-11-04: **rules implemented and tested as pure logic** (`app/lib/schedule.ts`, 19 tests). **No UI and no database tables yet.** Draft `supabase/migrations/011_schedule_effort_events.sql` is not applied. Recommendation: build the UI after the first alpha feedback, because durable saving and real usage matter more and testers may not want a weekly schedule at all.

## Two modes

**Flexible Rotation (default).** Next workout = the one after the last completed one. Missing days changes nothing. A new week changes nothing. Manual choice is always available. An explicit "Skip this workout" (planned, not built) advances the rotation and is recorded as a decision; a partial workout never counts.

**Weekly Schedule (optional, per plan).** Settings → "Follow a weekly training schedule". Pick days and assign workouts, or accept a suggestion (4 workouts → Mon, Tue, Thu, Fri; 3 → Mon, Wed, Fri). Not part of onboarding.

## Definitions (exact rules in code)

| Term | Rule |
|---|---|
| Scheduled | A weekday slot falling on a date on or after the schedule's `since` date |
| Completed | Finished session with at least one saved set, counted on the **local** date it was finished |
| Partial | Started, not finished. Never completed. Home shows Resume/Discard first |
| Skipped / rescheduled / dismissed | An explicit user answer, stored once per occurrence |
| Missed | Scheduled date has fully passed, that workout was not completed anywhere in the same training week, and the user has not answered about it |
| Rest day | A day with no slot. Nothing is ever missed on it |

Guards against false alerts: late-night training counts for that day; doing a workout early or on another day satisfies it; one completion satisfies one occurrence; duplicate slots never double count; nothing before the schedule was set (or last changed) can be missed; switching to rotation mode silences everything.

## What the user sees

Priority on Home: **1. Resume or discard an unfinished workout.** 2. New-week review (once per week). 3. Missed-workout prompt (once per occurrence). 4. Normal "Up next". Never during an active workout.

Missed: "You planned Lower A for Tuesday. Do it next, or continue with today's Upper B?" Actions: *Do Lower A next* / *Continue with Upper B* (Lower A stays unfinished, nothing is skipped silently) / *Move it to another day* / *Not now*. Each answer is saved, so the same prompt never repeats.

New week, only if last week has unfinished workouts: "New training week. 2 workouts from last week weren't done." *Continue where I left off* / *Restart this week's schedule* ("Lower A and Lower B from last week stay unfinished. Your history is unchanged.") / *Review them*.

## Data model (draft 011)
`plan_schedules` (mode, week_start, slots, since) and `schedule_decisions` (one row per answered occurrence, unique). Sessions never reference the schedule, so editing a schedule cannot rewrite history. Time zone: dates are computed on the device in the user's local zone; a trip across zones can shift one late-night session by a day, which the "same training week" rule absorbs.

## Effort tracking

**Default (everyone):** no RIR anywhere. Optional one-tap question after an exercise, shown at most for the first exercise and last exercise of a workout (to test whether people answer at all):
"How challenging was that?" *Easy: I could have done many more reps* · *Manageable: challenging but controlled* · *Very hard: close to my limit* · *Not sure*. Skippable, editable later in History.

**Settings → Track effort using RIR (off by default):** adds an optional "RIR" box to working sets with a one-line explanation: "Reps in reserve: how many more clean reps you could have done. 0 = none left." Values 0 to 10, blank allowed. Not switched on by choosing "Advanced" in onboarding.

**Data:** plain effort is per exercise (`exercise_logs.effort`); RIR is per set (`exercise_sets.rir`, added in 010). They are never converted into each other ("Very hard" is not RIR 0). Neither is used as proof of skill or readiness for harder exercises.

**Free vs Pro:** entering effort or RIR, and seeing it, is Free. Pro may later *interpret* it (RIR-informed progression, effort trends, adaptive intensity).

## Benchmarks to measure (not yet measured)
For Forgeload vs Strong and Hevy, with 5 testers each, on the tester's own phone: seconds from opening the app to the first set logged; taps per set; taps to correct a wrong set; what happens after a missed scheduled day; whether a beginner can explain "today's target" in their own words. Competitor behavior here has not been verified by us; record what testers actually see.
