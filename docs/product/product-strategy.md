# Product strategy and specification

Last updated 2026-11-04. This is the single source for product decisions. Where an older prompt or doc disagrees, this file wins. Evidence behind the positioning is in [competitive-research.md](competitive-research.md).

## Positioning to test

**Know what to lift next, free.** Forgeload remembers what you did, sets today's target, and tells you why. A rotation that never skips a workout because you missed a day. No caps on routines, custom exercises or history.

Why this and not "AI coach": Strong and Hevy are cheap loggers that leave progression to you (Hevy also caps free routines, custom exercises and history). The apps that tell you what to do are $72 to $300 a year with no free tier. A free, explained target sits in that gap. It is copyable, so the lasting edge has to be speed, trust and craft.

## Audience

Launch: gym-goers with 0 to 3 years of training who want structure. Beginners arrive through onboarding; early intermediates arrive because their free logger doesn't tell them what to do next. Advanced lifters are fully supported (custom splits, overrides, set-level logging) but are not the launch target.

## Resolved spec (supersedes older prompts)

| Topic | Decision |
|---|---|
| Onboarding | Five questions: days per week (1 to 6), experience (brand new, beginner, intermediate, advanced), goal (build muscle, get stronger, lose body fat while keeping muscle, general fitness), session length (20 to 30, 30 to 45, 45 to 60, more than 60 min), exercise comfort. Answers persist on the device until the plan is created. Experienced users can skip and build a plan themselves. |
| Home-equipment question | Removed. Forgeload is gym-first. |
| Exercise comfort | About confidence, not availability. Picks starting exercises only. "Not sure" = machines and dumbbells. Barbells only when the user picks "All gym equipment" or adds one. Never inferred from performance. Editable any time in Settings. |
| Beginners and frequency | A brand-new or beginner lifter who picks 5 or 6 days starts on a 4-day plan, with the reason shown and the 5 or 6-day plan offered. |
| Rotation | Next workout = the one after the last completed one, never the weekday. Home shows "Workout 2 of 4 in your rotation". The weekly view counts workouts done; it never says "2 of 4" against a weekly quota. A weekday-schedule option is a later idea needing user evidence. |
| Targets | Basic double progression, free. "Today's target" first, "why this target?" behind a tap. 5 lb default step. Leaving a box empty logs the target. |
| Set states | Planned, current, saving, saved (only after the server confirms), failed (retry). Skipped and set types (warm-up, drop) need migration 010. |
| Swaps | Today-only or in-plan. Optional reason. History always stays with the exercise actually performed. |
| Suggestions | At most one on Home. Accept, No thanks, Undo. Never applied without consent. Thresholds in `app/lib/rules.ts`. |
| Plateaus | Never called a plateau. "Steady lately, want to review?" Pro only, prototype only. |
| Free vs Pro | See [free-vs-pro.md](../design/free-vs-pro.md). Free is a complete tracker. No billing until Pro has real value and approval. |
| Pricing | Test $4.99/mo and $39.99/yr. Above Strong and Hevy, well under MacroFactor and Fitbod. Unvalidated. |
| Library | 772 exercises live, 42 reviewed for generated plans. Target 700 to 1,000+ useful exercises is met on count; quality (aliases, review) is the remaining work. |

## Decisions made autonomously (low risk, reversible)

- Rest default by rep range: 180s (6 or fewer reps), 120s (up to 10), 90s otherwise. In `rules.ts`.
- Duration estimate: 40 seconds of work per set plus the default rest, rounded to 5 minutes, labeled "about".
- Focus Mode is opt-in and remembered per device. Not the default until tested.
- Weekly dots start on Monday.
- No new runtime dependencies. Tests use Node's built-in runner.

## Next three milestones

1. **Durable logging (Priority 1/4).** A local write queue so a set tapped offline is kept and synced, with a visible "Waiting for connection" state, duplicate-safe retries, and set types and RIR (migration 010). *Done when:* airplane-mode test logs 5 sets, reconnects, and exactly 5 rows exist; refresh mid-save loses nothing.
2. **Progress and navigation (Priority 4).** Progress screen (per-exercise best set over time, PRs, simple chart), then test the five-tab nav (Home, Plan, Train, Progress, Library) against the current four with 5 people on real tasks. *Done when:* each tester finds "last time I benched" and "start my workout" in under 10 seconds.
3. **Beta (Priority 8).** 20 to 30 lifters, tracked with privacy-light product events (onboarding done, first workout, second workout within 10 days, target hit rate, "why" opens). *Done when:* we know week-1 and week-4 return rates and the top 3 reasons people would or wouldn't switch.

Pro features and billing come after the beta, only if users say they'd pay.

## Later: weekday schedule vs rotation (noted 2026-11-02)
Some lifters expect "it's Monday, show Monday". Idea: a per-plan setting, "Follow rotation" (default) or "Follow my weekly schedule". Needs beta feedback first.
