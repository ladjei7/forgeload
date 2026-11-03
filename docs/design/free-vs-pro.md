# Free vs Pro: boundaries, enforcement, and paywall

Status: prototype demo states only. **No payment processing exists.** Free/Pro in `/design-preview` is a labeled demo switch (Account sheet, Proto tools). Nothing is merged to main.

## Principle
Pro sells **better analysis and recommendations**, never access to your own data, ordinary logging, exercise choice, or safety information. Everything a user logs is private, exportable and deletable on every plan, including after a subscription ends.

## 1. Free (always)
- Personalized onboarding and starter plan, with a reason per exercise.
- Exercise comfort preference, editable any time. Preferred and "not for me" exercises are remembered (avoid list).
- Unlimited manual substitutions and custom exercises.
- Suggestions to save a repeated substitution, and optional swaps after a comfort change.
- Last-session performance, and basic double-progression targets with the explanation.
- Full history, personal records, basic progress, export, account deletion.
- Safety-related information (for example exercise descriptions and form notes) is never gated.

## 2. Pro (eventually)
- Advanced behavior-based recommendations.
- Adaptive volume and intensity suggestions.
- Deeper progression and trend analysis; evidence-supported plateau identification and recommendations.
- Personalized deload and program-adjustment recommendations.
- Advanced analytics and actionable insights; custom progression rules.
- Multiple saved and switchable programs.

## 3. Enforcement (designed, not built)
Client UI is cosmetic. The real checks are on the server.
- `entitlements` table (draft `007_entitlements.sql`): one row per user, `tier`, `status`, `current_period_end`. Row-level security lets a user read their own row. **No write policy exists for signed-in users**, so no one can grant themselves Pro. Only the server using the service role, from a signature-verified billing webhook, writes it.
- `my_tier()` returns the effective tier with a 7 day grace period. A missing row means free.
- Pro computations run on the server (API route or edge function) that calls `my_tier()` itself and returns 403-style "locked" payloads without the analysis. Never trust a tier sent by the client, a cookie, or local storage.
- Pro endpoints return only derived insights. Raw workout tables have no tier check anywhere, so a lapse can never hide or delete data.
- Failure mode: if the entitlement check errors, logging and history keep working and Pro features show as temporarily unavailable. Fail closed on Pro analysis, open on data.
- Keys and webhook secrets stay in server env vars, never in the repo or chat. Webhook handling is idempotent and logged.
- Tests required before launch: a free user cannot read Pro output via direct API calls; cannot write `entitlements`; a lapsed user still has full export; webhook with a bad signature is rejected.

## 4. Implemented vs planned
| Feature | Tier | Status |
|---|---|---|
| Comfort question, generator, reasons | Free | Prototype |
| Save repeated swap suggestion (Home, undoable) | Free | Real app |
| Swap exercise today or in plan, with history preserved | Free | Real app |
| Comfort preference, changeable in Settings, included in export | Free | Real app |
| Not-for-me, comfort-up offers, preference swaps | Free | Prototype |
| Targets, history, export | Free | Existing app |
| Plateau identification (rule: no better top set in 3 sessions) | Pro | Prototype (one rule) |
| Workout length vs session time fit | Pro | Prototype (one rule) |
| Behavior-based recommendations beyond these | Pro | Planned |
| Deload and program adjustment | Pro | Planned |
| Trend analytics, custom progression, multiple programs | Pro | Planned |
| Billing, server enforcement, entitlements table | n/a | Drafted SQL only, not run |

Honest caveat: the two prototype Pro rules are simple. Whether they are worth paying for is untested. The real Pro value needs the richer planned features and real usage data.

## 5. Introducing the paywall
- Never during a workout, set entry, rest, or logging. The workout screens contain no upgrade UI at all.
- Appears only on Home, as one quiet card ("2 training insights ready"), after the user has data worth analyzing. It names the kind of insight, never hides safety info or the user's own numbers.
- One tap opens a sheet: what is always free, what Pro adds, and an honest "Planned" label on unbuilt features. "Not now" is equal weight to the primary button. No countdowns, no repeated nagging.
- A free user keeps getting free suggestions. Declining Pro changes nothing.
- Prototype: "Preview Pro (demo)" turns on the Pro behavior with a visible "Pro demo" chip. Switch back in Account.

## Exercise library foundation
`002_exercise_identity.sql` (already run) gives stable ids and search. Draft `006_library_comfort_and_prefs.sql` adds `comfort_level` (reusing 002 `plan_eligible`: only reviewed exercises feed the generator), `user_training_prefs`, and an append-only `user_events` log. RepDB data is imported locally by the owner and never committed (`.gitignore` now blocks `/data/` and `repdb*`). The visible "Exercise data by RepDB (repdb.co)" credit ships with the data. The import itself is not done and needs your go-ahead.
