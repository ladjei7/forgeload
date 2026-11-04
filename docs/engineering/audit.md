# Repository, security and test audit

Last updated 2026-11-04 (evening). Production = `main` at `bd58399`. Work in progress on `durable-saving`. Earlier audits are in git history.

## Environments
- **Production** Supabase `ltvhszozgzgymsbexgps` serves forgeload.vercel.app. Migrations 001-010 applied (010 on 2026-11-04 21:18 UTC, verified; rollback script `010_rollback.sql`, not run).
- **Development** Supabase `forgeload-dev` (`lwngtnwpycohbqimwqoh`), created 2026-11-04 from `supabase/schema/baseline.sql`, seeded with 113 starter exercises, no user data. Previews should use it once the owner sets the Preview environment variables in Vercel.
- Supabase organization is on the free plan (2 projects, the limit). Platform backup availability not verified from here; a private pre-010 snapshot exists off-repo.

## Versions (installed, verified)
Next.js 16.4.3, React 19.2.8, Tailwind 4.3.3, supabase-js 2.112.4, TypeScript 5.9.3. Next.js was upgraded out of the 16.0 to 16.4.0 advisory range earlier.

## What is real vs prototype

| Area | Real app | Prototype only |
|---|---|---|
| Auth, email confirmation, redirect to the signup origin | Yes | |
| Plans, templates, rename, reorder, edit sets and reps, replace exercise with Undo | Yes | Expand/collapse editor, rotation pills |
| Five-question onboarding (final wording) and comfort-aware starter plan | Yes (this branch updates wording and answers) | Full generator with per-exercise reasons |
| Home around next workout, rotation position, duration, last and target, first-workout state | This branch | |
| Logger: target, previous, tap-to-fill, rest with pause, elapsed time, Focus Mode | Production | |
| Durable saving: on-device outbox, device-made ids, idempotent upserts, on-device/syncing/saved/failed states, auto retry, finish guard, sign-out warning | `durable-saving` branch (not merged) | |
| Swap for today or in plan, optional reason, "make it default" suggestion | Yes (reason on this branch) | Not-for-me, comfort-up, preference swaps |
| History, finish summary with heaviest-weight PRs, export (JSON/CSV), account deletion | Yes | Completion redesign |
| Progress screen, charts, five-tab nav | No | Yes |
| Set types, RIR/RPE, skipped sets | Columns exist (010); no UI yet | Partly |
| Weekly schedule, missed-workout prompts, effort question | Rules + tests only (`schedule.ts`); tables in draft 011 | Design doc |
| Entitlements | Table and `my_tier()` exist, unused | Free/Pro demo switch |
| Billing | No | No |

## Database (inspected live, read-only, 2026-11-04)
- 772 catalog exercises (71 original, 701 RepDB). 42 `plan_eligible`. **502 have no aliases**, which weakens search ("DB bench"). No duplicate names. Trigram index on name exists.
- One user, one session, zero logged sets. No real training data is at risk from schema work yet. This is the cheapest time to add set types.
- `exercise_sets` has no `set_type`, `rir` or `rpe`. Draft `010_set_details_and_rls_perf.sql` adds them (nullable or defaulted, additive). **Not applied.**
- Migrations applied: 001 to 009. 009 (function hardening) was applied 2026-11-02 with your approval.

## Security
| # | Finding | Status |
|---|---|---|
| 1 | RLS on every table; owner-only policies on all user data | Verified 2026-11-02: a stranger and an anonymous visitor see 0 rows in every table (live isolation test) |
| 2 | `my_tier()` was callable by anonymous visitors | Fixed (009) |
| 3 | Four functions had a mutable search_path | Fixed (009) |
| 4 | Child rows check their own `user_id`, not the parent's owner. Someone who knows another user's plan id could attach a row to it, but still can't read it. | Low. Fix: add parent-owner checks to `with check` (in 010 draft notes) |
| 5 | Leaked-password protection | Dashboard setting, may need a paid plan |
| 6 | Service-role key never used in the app or repo; only the publishable key ships | Verified by inspection |
| 7 | Entitlements: no write policy for users; client tier is display-only | Verified |
| 8 | Performance advisor: 21 policies re-evaluate `auth.uid()` per row; 12 foreign keys unindexed | Harmless at 1 user. Fixed in 010 draft |

## Known data-loss conditions
- **Production today:** a set that fails to save shows "Not saved, tap ↻". If the user closes the app before retrying, that set is lost.
- **With `durable-saving`:** sets survive refresh, app close and offline periods on the same browser. Still lost if the user clears site data, uses a private window that is then closed, or switches device before it syncs. Starting a workout and reopening the workout screen still need a connection (no offline app shell yet).
- Conflicts: the same set edited on two devices at once ends with the last write. Single-device use (the normal case) has no conflict.

## Tests (run 2026-11-04)
- `npm test`: **99 pass, 0 fail** (Node test runner, pure logic: progression, rotation, dates, comfort, recommend and tailoring, swap suggestions with reasons, Home summary, generator, adaptation rules, entitlements, RepDB mapping).
- `npx tsc --noEmit`: clean.
- `next build`: succeeds.
- Lint: **10 errors, 1 warning**, all `react-hooks/set-state-in-effect` or similar in pages that predate this branch, plus Settings theme load. Not behavior bugs; worth a cleanup pass.
- Browser (Playwright against a **mocked** Supabase, not the real database): 12 logger checks (saving shown before confirm, saved only after confirm, failure then retry, rest pause/resume, Focus Mode logs through the same state and auto-advances, standard mode sees the same sets, swap reason stored), Home new vs returning user, Settings comfort, swap and suggestion flows.
- **Not covered:** real-device mobile browsers, real network loss, the live database end to end, accessibility audit with a screen reader, visual regression.

## Test strategy going forward
1. Keep business rules as pure functions with unit tests (fast, no network).
2. Browser flows against the mocked API for every logger change (the scripts live outside the repo today; move them into `tests/e2e/` with Playwright as a dev dependency once approved).
3. Before beta: one scripted run against a throwaway Supabase project with two real accounts (isolation, logging, export, delete).
