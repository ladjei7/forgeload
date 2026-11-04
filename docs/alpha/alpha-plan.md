# Private alpha plan (3 to 5 testers)

## Go / no-go before inviting
| Check | How | Status 2026-11-04 |
|---|---|---|
| Auth: signup, email confirmation, login, logout | Owner smoke test on production | **Pending owner test** |
| User isolation | Live read-only test + two-account write test on dev | Passed |
| Migration 010 understood and applied | Review, snapshot, apply, verify | Done |
| Onboarding and plan creation | Owner smoke test | **Pending owner test** |
| Edit plan, replace exercise | Owner smoke test | **Pending owner test** |
| Logging persists under normal signal | DB save chain verified; mocked browser tests | Passed (DB + mock); owner test pending |
| History shows completed workouts | Owner smoke test | **Pending owner test** |
| Production site and schema compatible | Production code needs no new columns; 010 is additive | Yes |
| Offline limits disclosed | Tester guide | Done |

**No-go if:** any cross-account read, a lost or duplicated set, signup or login broken, or a workout that can't be finished.

## What production has vs this branch
Production: logging saves directly to the server; a failed set shows "Not saved, tap ↻". If the tester closes the app before retrying, that set is lost. **Durable saving (on-device outbox) is on the `durable-saving` branch, not in production yet.** Recommendation: approve merging it before testers do their *second* workout, or before inviting if you prefer.

## Metrics that matter
Activation: signup → onboarding done → plan saved → first workout started → first completed. Retention: second workout within 10 days. Quality: sets logged per workout, failed syncs per 100 sets, sets edited after logging, target hit rate (logged ≥ target reps at target weight), swaps per workout, suggestion accepted vs dismissed.
Today, "swap" and "suggestion" are already recorded in the `user_events` table. The other events need draft 011 (it widens the allowed event kinds). Until then, read activation from the tables themselves (plans, sessions, sets per user). Never collect notes or free text as analytics.

## Severity
P0 security, data loss, broken login: stop the alpha and fix. P1 logging failure, wrong records, blocking confusion: fix before inviting more. P2 friction and confusing copy: batch. P3 polish: later.

## Exact test plan for the owner (production, 10 minutes)
Use a new alias such as yourname+alpha1@gmail.com.
1. Sign up, confirm the email link, log in, log out, log in again.
2. Answer the five questions; create the plan.
3. Plan → replace one exercise via search; check the list updates.
4. Start a workout; log 2 sets; tap one ✓ to undo it; log it again; use the rest timer; Finish.
5. History shows the workout with the right sets; Home shows "Last" and "Target".
6. Settings → Export → JSON downloads and contains the workout.
Report any step that fails before inviting anyone.

## Then expand
After 3 to 5 testers and P0/P1 fixed: 20 to 30 testers across beginners, intermediates, advanced lifters, current app users and spreadsheet users. Judge by second- and fourth-week workouts logged, not by compliments.
