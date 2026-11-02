# Repository audit (2026-11-02)

Scope: code in `main` at `44ae4fc`. The live database could not be inspected from here and the repo had no migrations, so database statements below come from earlier setup work, not from a schema dump.

## Feature inventory vs the product brief

| Area | Status |
|---|---|
| Auth (email + password, client-side gate) | Works. Gate is client-only; nav shows on /login. |
| Plans, days, exercises: create, rename, edit sets/reps, reorder, delete | Done |
| Split templates (PPL x2, Full Body A/B/C, Upper/Lower x2, Anterior/Posterior, PPL/UL, PPL/Arnold) | Done |
| Exercise library (149 built-in), search with aliases, custom exercises | Done |
| Log page | **Rebuilt in this branch** (was: manual day dropdown, no resume, duplicate-prone) |
| History | Works; two bugs fixed here |
| Next-workout rotation | New in this branch |
| Previous performance, basic target, rest timer, finish summary | New in this branch |
| Home dashboard | Placeholder |
| Onboarding questionnaire | Not started |
| Substitution, RIR/RPE, set types, kg/lb, notes | Not started |
| Export, PR history, charts, offline mode | Not started |
| Entitlements / billing | Not started (intentionally) |
| Tests | None existed. Logic tests added. |

## Bugs found and fixed in this branch

1. **Wrong date for evening workouts.** `session_date` used `toISOString()` (UTC). In Chicago after ~6-7 PM that stores tomorrow's date. Now uses local date.
2. **History showed the previous day** because `new Date('YYYY-MM-DD')` is parsed as UTC. Now parsed as local.
3. **No resume.** Refreshing mid-workout lost the session, and starting again created a second one. Now an unfinished session reopens.
4. **Duplicate sets.** Every tap of the check inserted another row. Now one row per set, taps are ignored while saving, and tapping a done set undoes it.
5. **Day dropdown listed days from every plan** with no notion of what is next. Now scoped to the plan and driven by the last completed session.
6. **Previous performance** needed 2+ sessions of the same day and compared by day, not by exercise. Now uses the most recent completed log of that exercise.
7. **Empty sessions** appeared in History. History now shows completed sessions only; a workout with nothing logged is discarded.

## Security and data-integrity findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | **Next.js 16.3.2 is in an advisory range (16.0.0-16.4.0)**, including critical RCE advisories. Several are Windows-host or image/OG specific and this app is on Vercel (Linux) and does not use `next/image`, so practical exposure looks low, but it should be patched. 16.4.3 is available. | High | Separate branch `chore/next-security` |
| 2 | `sharp` and `source-map-js` advisories (high). Transitive. | Medium | Fixed by the same upgrade or `npm audit fix`; verify |
| 3 | Email confirmation is disabled in Supabase (for testing). Anyone can sign up with any address. | Medium | Re-enable before real users |
| 4 | RLS "own rows" policies exist per earlier setup but were **not re-tested** this session. Needs the three-way test: anonymous, owner, a second authenticated user. | Unknown | Open |
| 5 | Child tables (`exercise_logs`, `exercise_sets`) carry `user_id`, but a foreign-key reference to another user's parent row is not checked by RLS alone. Needs a policy `with check` that the parent belongs to the user. UUIDs make guessing impractical, but this should be closed. | Low-Med | Open |
| 6 | No server-side validation. Acceptable for own-data CRUD behind RLS; revisit before paid features. | Low | Noted |
| 7 | Exercises are referenced by name string in `plan_exercises` and `exercise_logs`. Renaming or substituting an exercise can split its history. Needs a stable exercise id. | Medium | Planned (Phase 3) |
| 8 | Schema was not version controlled. | Low | Started: `supabase/migrations/` |
| 9 | No data export or account deletion yet. | Medium | Planned |
| 10 | The Supabase publishable (anon) key is in the browser by design. Secrets are not in the repo (`.env*` ignored). | OK | Verified by inspection |

## Database change in this branch

`supabase/migrations/001_session_state.sql` adds `started_at` and `completed_at` to `workout_sessions`. Additive only; backfills existing sessions as completed using their own date. The old app code keeps working after it runs. Rollback is in the file. **Must be run once by the owner before testing the branch.**

## What is not covered by tests

The unit tests cover progression, rotation and date logic. The Log page was exercised in a real browser against a **simulated** Supabase (load, start, one-tap logging, double-tap protection, reload-resume, finish). It has **not** been tested against the real database or on a physical phone.
