# UX benchmark (2026-11-02)

**Evidence quality, stated up front.** I read official feature pages, app-store listings and one independent review (TechRadar). I could **not** use the apps myself, and I did **not** view verified screenshots of any of them. So the table describes documented behavior, not how it feels to use. Claims about friction come from reviews and are marked. Alpha Progression, Boostcamp and MacroFactor were only covered earlier for pricing and progression rules, not interface; their interface rows are blank on purpose.

## Verified facts by product

| Product | Documented behavior (source) |
|---|---|
| **Hevy** | Four set types (normal, warm-up, failure, drop); tap the set number to change type; drop sets show a blue "D" and skip the auto rest timer ([Hevy set types](https://www.hevyapp.com/features/workout-set-types/)). Rest timer starts when you complete a set; per-exercise rest from 5 s to 5 min; -15/+15 buttons; notification at zero; can be turned off per exercise ([Hevy rest timer](https://www.hevyapp.com/features/workout-rest-timer/)). |
| **Strong** | App Store listing calls it "the simplest interface of any fitness app"; rest timer, set tags (warm-up, failure, drop), supersets, plate and warm-up calculators, PRs, estimated 1RM, CSV export, Live Activity rest timer (v6.5.1). Free: unlimited logging, 3 custom routines. Pro: $4.99/mo or $29.99/yr listed. Reviews note an iPad layout that is iPhone-sized ([App Store](https://apps.apple.com/za/app/id464254577)). |
| **Fitbod** | Onboarding: equipment profile, then a goal; sessions of 15 to 90 minutes generated for chosen muscle groups; Recovery tab shows muscle freshness; logs like a checklist; swap exercises for similar ones. Free trial limited to 3 workouts; $12.99/mo or $79.99/yr. Reviewer: experienced lifters get less value from its guidance ([TechRadar](https://www.techradar.com/health-fitness/fitbod-app-review)). |
| **Liftosaur** | The program decides your next workout; weights and reps are **prefilled so you can often just confirm each set**; weights round to your plates; rest timer after each set; short onboarding (units required, equipment and 1RM skippable); progression rewrites the program text; weekly sets per muscle group are shown against a target range. Author notes editing long program text on a phone is inconvenient ([Liftosaur overview](https://www.liftosaur.com/blog/posts/liftosaur-overview/)). |
| **Boostcamp, Alpha Progression, MacroFactor Workouts** | Pricing and progression criteria only (see `docs/product/competitive-research.md`). Interface not reviewed. |

## What this implies (and what it does not)
- **Prefilled, confirm-to-log is already a competitor feature** (Liftosaur). Forgeload's one-tap logging of the suggested set is a match, not a unique claim.
- **Set types, per-exercise rest timers, live-activity timers, plate math, Watch apps** are table stakes for the leaders. Forgeload currently has none of them except a global rest timer.
- **Onboarding is short everywhere** (Liftosaur skips most setup; Fitbod asks equipment, goal, duration). Our 4-question wizard is in the normal range.
- **Free-tier limits differ:** Strong limits routines, Fitbod limits workouts. Our "unlimited logging, plans and custom exercises" is more generous than both on paper; whether that wins people is unproven.
- **Price anchors:** Strong $4.99/$29.99, Fitbod $12.99/$79.99. Our proposed $4.99/$39.99 sits at the Strong level monthly and above it yearly. Untested.

## Design opportunities (each tied to a user problem)
1. **Always-visible save state per set.** Problem: a gym user cannot tell if a set was recorded when signal is bad. Our audit shows failed saves appear as a distant banner. A per-set state (pending, saved, failed with retry) is an honest differentiator because it targets trust, not features.
2. **One-hand logging layout.** Problem: five narrow columns at 390 px. Move to a card per exercise with a large current set, stepper-style weight and reps, and a single full-width Done control within thumb reach. Needs real-gym testing before claiming it is faster.
3. **A persistent "workout in progress" bar** across all tabs. Problem: leaving the Log tab mid-workout leaves no obvious way back and no sign the session is open.
4. **Explain the target in plain words, once.** Problem: coaching text clutters the logger. Keep "why?" collapsed, as now, and use the sample wording from the brief.
5. **Set types and per-exercise rest** to reach parity where lifters expect them (warm-up, drop, failure), as a later increment.
6. **A real token and component layer** so the above ships consistently (audit finding 1).

## Not claimed
Faster than Hevy or Strong; better onboarding than Fitbod; or any "unique" progression feature. Competitors already offer progression and generated plans. The aim is a clearer, more trustworthy logging and next-workout experience, to be validated with lifters.
