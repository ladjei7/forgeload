# Free vs Pro: boundaries, enforcement, and paywall

Status (2026-11-04): **no payment processing exists.** Free/Pro is a labeled demo switch in `/design-preview`. In the real app every user is Free. The `entitlements` table and `my_tier()` exist in the database (007 and 009 applied), every row defaults to free, and nothing in the app is gated yet.

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
| Five-question onboarding (final spec wording) and comfort-aware starter plan | Free | **Real app** |
| Comfort preference in Settings, included in export | Free | **Real app** |
| Swap exercise for today or in the plan, optional reason, history preserved | Free | **Real app** |
| "Make this swap your default?" (3 swaps in 30 days, reasons "equipment" and "just today" ignored), Accept, No thanks, Undo | Free | **Real app** |
| Last performance and double-progression target with "why this target?" | Free | **Real app** |
| Unlimited plans, routines, custom exercises, history; CSV/JSON export | Free | **Real app** (no caps exist) |
| Not-for-me, comfort-up offers, preference swaps (max 2 at a time) | Free | Prototype |
| "Steady lately" review prompt (same best set for 3 sessions, conservative wording) | Pro | Prototype (one rule) |
| Workout length vs session time | Pro | Prototype (one rule) |
| Behavior-based recommendations, adaptive volume and intensity, deloads | Pro | Planned |
| Trend analytics, per-muscle workload, custom progression, multiple switchable programs | Pro | Planned |
| Entitlements table, `my_tier()`, fail-closed client helper `getTier()` | n/a | **Built, unused** (no Pro feature exists yet) |
| Billing | n/a | Not built. Needs approval |

Honest caveat: the two prototype Pro rules are not worth $39.99 a year on their own. Competitors that charge for intelligence (MacroFactor $71.99/yr, Fitbod ~$80 to $96/yr, RP $299.99/yr; see `docs/product/competitive-research.md`) do much more. **Do not launch Pro until at least multiple programs, trend analytics and plateau review exist and beta users say they'd pay.**

### Program entitlement on downgrade (proposed, not built)
Free has one *active* program. Pro can keep several and switch. After a downgrade: every program and all history stay; the user picks which program is active; the others become read-only (viewable, exportable, duplicable into the active slot) and nothing is deleted. Tests before billing: downgrade keeps all rows, export still complete, switching is blocked server-side not just hidden.

## 5. Introducing the paywall
- Never during a workout, set entry, rest, or logging. The workout screens contain no upgrade UI at all.
- Appears only on Home, as one quiet card ("2 training insights ready"), after the user has data worth analyzing. It names the kind of insight, never hides safety info or the user's own numbers.
- One tap opens a sheet: what is always free, what Pro adds, and an honest "Planned" label on unbuilt features. "Not now" is equal weight to the primary button. No countdowns, no repeated nagging.
- A free user keeps getting free suggestions. Declining Pro changes nothing.
- Prototype: "Preview Pro (demo)" turns on the Pro behavior with a visible "Pro demo" chip. Switch back in Account.

## Exercise library (status 2026-11-04)
772 catalog exercises are live (71 original, 701 imported from RepDB under its free-tier license, not committed to the public repo; credit shown in Settings). 42 are reviewed and eligible for generated plans. The rest are searchable and selectable by hand. See `exercise-library-import.md`.
