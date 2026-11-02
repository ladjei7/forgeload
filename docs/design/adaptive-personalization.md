# Adaptive personalization: architecture and roadmap

Status: prototype on the `design-exploration` branch (route `/design-preview`, mock data). Nothing here touches production, the database, or `main`.

## Principles
1. **Suggest, never silently change.** Every change to a plan is something the user accepted. Each suggestion has a plain-language reason, a "No thanks", and an Undo after accepting.
2. **Comfort is something the user tells us.** It is never inferred from weights, reps, or progress. Getting stronger on a machine press does not mean a barbell is wanted.
3. **Preferences are editable at any time.** Changing one never rewrites the plan. It only offers optional swaps, one at a time or all at once.
4. **History is permanent.** Every logged set stores the exercise it was done on. Swapping an exercise in a plan never edits past sets.
5. **Curated, explainable rules first.** No model. Each rule is a small pure function with tests.

## Onboarding
Five short questions: days per week, experience, goal, session length, and exercise comfort: "What exercises would you feel most comfortable starting with?"

| Answer | Level | Starting exercises |
|---|---|---|
| Mostly machines | 1 | machines and cables only |
| Machines and dumbbells | 2 | adds dumbbells and bodyweight |
| All gym equipment | 3 | adds barbells |
| I am not sure | 2 | same as "Machines and dumbbells". Barbells only when the user chooses them |

The answer only decides which exercise is picked first for each movement. It does not limit the library, and any exercise can be swapped in later. Example: level 1 gets a machine chest press where level 3 gets a barbell bench press. Further comfort feedback is optional and collected after workouts (one tap per exercise), not in onboarding.

## Plan generation (`generate.ts`)
Input: days, experience, goal, session length, comfort, optional avoid list. Output: plan, a reason per exercise, weekly sets per muscle, notes. Deterministic.
1. **Split** by days: 2 to 3 full body, 4 upper/lower, 5 upper/lower plus push/pull/legs, 6 push/pull/legs twice.
2. **Slots** per workout, each a movement pattern with a priority (squat, hinge, horizontal and vertical push and pull first; isolation and core last).
3. **Pick** per slot from curated `PICK[pattern][level]`. The second workout of a pattern takes the next variation, so days differ. Avoided exercises are skipped. If nothing allowed exists in the comfort range, the slot stays empty and a note says so. Comfort is never overridden.
4. **Fit the time**: drop the lowest-priority slots until the estimate is within the chosen length (never below three exercises).
5. **Explain**: each exercise gets a sentence on what it trains and why it fits.

Tested guarantees (all days x times x goals x experience x comfort): every main movement pattern is covered across the week; each major muscle has enough weekly sets; machines-only plans have no free weights; "not sure" equals "machines and dumbbells"; barbells and pull-ups appear only at level 3; workouts fit the chosen time; no duplicates; every exercise has a reason.

## Suggestion engine (`adapt.ts`)
Inputs are an append-only event log (swap, skip, comfort feedback), logged history, plan, comfort, avoid list, and session length.

| Rule | Trigger | Proposes |
|---|---|---|
| Repeat swap | Same A to B swap 3 times in 30 days | Make B the default (history of A stays) |
| Not for me | Skipped 3 times, or marked "Not for me" once | Same-movement alternative inside the comfort range |
| Stalled | No better top set over 3 sessions | A variation. Keeping it is offered as equally fine. Never changes weight or comfort |
| Time | A workout is longer than the session length | Remove the smallest exercise |
| Comfort up | "Comfortable" on 3 different exercises, and no "Unsure" or "Not for me" | Offer the next comfort level. Changes the options shown, not the plan |
| Preference change | User changes comfort | Optional swaps per exercise |

Guardrails with tests: nothing is applied by the engine; large performance gains never produce a comfort or barbell suggestion; replacements respect comfort and avoid list (only an exercise the user chose themselves can exceed it); dismissed suggestions stay hidden; accepting leaves history untouched.

## Data model for the real app (not built)
- `exercises`: curated library with `pattern`, `equipment`, `comfort_level`, primary and secondary muscles, `unilateral`, `bodyweight`.
- `set_logs.exercise_id` per set. Plans reference exercises but history never does through the plan.
- `plan_versions`: append-only. Accepting a suggestion adds a version, which is what makes Undo and history safe.
- `user_prefs`: comfort, avoid list, session length. Editable any time.
- `user_events`: swap, skip, comfort feedback, suggestion shown/accepted/dismissed. Append-only, owned by the user, included in data export and account deletion.
- RepDB mapping (licensed free tier, data kept out of the public repo): `equipment` to level, `category`/`mechanic`/`body_part` to pattern. Metadata is reviewed by hand before it can be picked by the generator; unreviewed exercises remain searchable only.

## Roadmap
- **v1 (this prototype):** rules above, comfort question, reasons, preferences, optional feedback card. Test with 5 lifters (see usability test plan, tasks 15 to 18).
- **v1.1:** optional effort rating per exercise (easy / right / hard) feeding rules like "hold weight when it felt hard twice". Session length changes that trigger trims.
- **v2:** suggestions use the user's own accept/dismiss history (stop offering what they keep declining), weekly volume balance, and deload prompts.
- **v3 (only if v1 to v2 data justifies it):** richer ranking across a larger curated library. Still explainable and still opt-in.

## Open questions
- Does an optional feedback card get answered, or ignored? Measure the response rate before building rules that depend on it.
- Are three repeats the right threshold? It is a guess.
- Pro tier fit (untested): suggestions beyond v1 rules could be the paid "intelligence" layer. The v1 rules should stay free.
