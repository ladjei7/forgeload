# Competitive research

Last updated: 2026-11-04. Earlier pass: 2026-11-02. Status: **pricing and free limits verified for 6 of 8 named competitors from official pages or app store listings. User-pain evidence is thin.** Read the evidence column before relying on any row.

## How to read this

- **Verified:** taken from the company's own help center, pricing page or App Store listing on the date above. Prices are US App Store and change often.
- **Claim:** from the company's own marketing about itself.
- **Hearsay:** from a competitor or a review site. Not relied on for decisions.
- Affiliate "best app" blogs dominated search results and were not used.

## Comparison

| App | Free tier | Paid | Progression guidance | Evidence |
|---|---|---|---|---|
| **Strong** | Unlimited workouts, **3 custom routines** | $4.99/mo, $29.99/yr, $99.99 lifetime (listing) | Records, 1RM estimate, warm-up and plate calculators. No target-setting described. | Verified: [App Store](https://apps.apple.com/app/id464254577), 4.9 from 109K ratings |
| **Hevy** | **4 routines, 7 custom exercises, 3 months of data history**; no warm-up calculator | Monthly, annual, lifetime (price not on the help page) | Free: you decide. Pro adds stats (sets per muscle group). | Verified limits: [Hevy help center](https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include). Price: hearsay ($2.99/mo, $23.99/yr per Boostcamp) |
| **Boostcamp** | Unlimited logging, rest timer, RPE, PRs, large program library | $14.99/mo, $59.99/yr | **Auto progression is paid.** History kept on cancel. | Verified: [official page](https://www.boostcamp.app/is-boostcamp-free) (2026-11-02 pass) |
| **Alpha Progression** | Logging, manual plans, timers, records, export | $12.99/mo, $79.99/yr | Double progression with gym-specific steps, **automation is paid** | Claim: [Alpha blog](https://alphaprogression.com/en/blog/best-progressive-overload-apps) |
| **MacroFactor Workouts** | **No free tier**, trial only | $11.99/mo, $47.99/6 mo, $71.99/yr; bundle $89.99/yr | Uses weight, reps and RIR against the assigned range; can raise, hold or lower load | Verified: [price page](https://macrofactor.com/workouts/price/), [help](https://help.macrofactorapp.com/en/articles/372-what-does-progressive-overload-mean-in-macrofactor-workouts) |
| **Fitbod** | Trial only | $12.99 to $15.99/mo, $79.99 to $95.99/yr (several price tiers listed) | AI-generated workouts, "learns from your edits", weight suggestions from last session | Verified: App Store listing (4.8 from 289K ratings) |
| **RP Hypertrophy** | Trial unclear | **$34.99/mo, $299.99/yr** | Adjusts week to week from pump, soreness and workload feedback | Verified: [App Store](https://apps.apple.com/app/id1555614554), 4.4 from 161 ratings |
| **Liftosaur** | Free app with in-app purchases (split not stated) | Not stated on listing | Scriptable progressions (Liftoscript), built-in 5/3/1, GZCLP | Verified features: [App Store](https://apps.apple.com/us/app/liftosaur/id1661880849), [site](https://liftosaur.com/). Pricing not verified |

## What this changes

1. **The free logger market is crowded and cheap.** Strong and Hevy both log unlimited workouts for free, and their paid tiers cost $24 to $30 a year. Forgeload cannot win by charging for basics, and "a better free logger" alone is not a business.
2. **Free limits are the obvious pressure point.** Strong caps free users at 3 routines. Hevy caps them at 4 routines, 7 custom exercises and 3 months of history. A free tier with unlimited routines, unlimited custom exercises and full history is a concrete, verifiable promise. *Confidence: high that the limits exist. Unknown whether they make people switch.*
3. **"What to lift next" is paid or absent everywhere we checked.** Boostcamp and Alpha charge for it, Strong and free Hevy leave it to you, and MacroFactor, Fitbod and RP have no free tier. Free, explained targets are a real gap at the free tier. *Confidence: medium. Any competitor could copy it.*
4. **Adaptive apps are expensive.** MacroFactor ($72/yr), Fitbod (~$80 to $96/yr) and RP ($300/yr) prove people pay for "the app decides". Pro at $39.99/yr sits between the cheap loggers and these. That's a reasonable test price, but only if Pro does real analysis.
5. **Rotation versus calendar.** A trainer-app feature request with 50 votes asks to pause or push back schedules after missed days ("it just keeps going as wk1 day 7 when in reality I'm only on wk 1 day 2", [ABC Trainerize ideas](https://ideas.abcfitness.com/forums/940789-client-gym-members-abc-trainerize/suggestions/42348535-ability-to-restart-pause-or-push-back-workouts-or)). That's one product's users, not proof of a market gap. *Confidence: low.*

## Ranked user problems (hypotheses until beta)

| # | Problem | Evidence | Feasible for us | Likely to drive switching or paying |
|---|---|---|---|---|
| 1 | Not knowing what to lift next | Paywalled at Boostcamp and Alpha; the whole premise of MacroFactor, Fitbod and RP | Yes, rules engine exists | Switching: maybe. Paying: yes for deeper versions |
| 2 | Free-tier caps on routines, custom exercises, history | Verified limits at Strong and Hevy | Yes, we already don't cap | Switching: unknown |
| 3 | Slow logging between sets | Not verified; this is common sense and our own design priority | Yes | Retention more than switching |
| 4 | Schedules that break when you miss a day | One feature request, 50 votes | Yes, rotation already implemented | Unknown |
| 5 | Beginner plans with intimidating lifts | No direct evidence found | Yes, comfort question | Unknown |
| 6 | Switching cost: years of history in another app | Inferred | Partly, needs CSV import | **High blocker** |

## Recommended position

**Initial audience:** gym-goers with roughly 0 to 3 years of training who want structure. That covers beginners through the five questions, and early intermediates who use a free logger but don't know how to progress. Experienced lifters stay supported but aren't the launch target. Liftosaur already serves the power users who want scripting.

**Positioning to test:** *Know what to lift next, free. Forgeload remembers what you did, sets today's target, and tells you why.* Proof points: unlimited routines, custom exercises and history in Free; targets with reasons; a rotation that never skips a workout because you missed a day.

**Why not lead with "adaptive AI":** Fitbod and MacroFactor own that message and have years of data. Our rules are transparent and testable, which is better to lead with than "AI".

## Open questions for the beta

- Do people actually follow the target, or ignore it? Measure target hit rate and whether users edit the prefilled numbers.
- Does free progression make anyone leave Strong or Hevy, or is history import the real blocker? Ask, then measure.
- Do people read "why this target?" Count opens.
- What would they pay for after a month? Show the Pro comparison and record intent, without billing.

## Not verified

Hevy prices (help page doesn't list them, and the App Store page was unreachable), Liftosaur pricing, user complaint frequency (Reddit and app review text were not accessible from the research environment), and market size.
