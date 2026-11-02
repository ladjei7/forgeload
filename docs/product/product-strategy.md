# Product strategy (working draft)

## Positioning to test

The free tracker that tells you what to lift next, and why. Fast logging, a program that follows your completed sessions instead of the calendar, and honest guidance you can override. Not unique on its own (see competitive-research.md); the aim is to execute it better and more openly than the paid alternatives.

## Audience

Phase 1: lifters on a structured split who want clearer progression. Phase 2: beginners via a five-question questionnaire that selects and adjusts an existing template (rules-based, editable, never forced).

## Free vs Pro

Free forever: unlimited logging, plans and templates, onboarding questionnaire, one active program, previous performance, **basic double-progression targets with the reason shown**, rest timer, PRs, basic charts, history, data export. Cancelling Pro never locks your history.

Pro (not built, not sold): multiple switchable programs, adaptive progression using several sessions and effort, stall detection, deload/periodization suggestions, per-muscle analytics, reports.

Price: **untested.** Competitor evidence suggests lower than the earlier $8/mo idea. Test $4.99/mo and $39.99/yr against real willingness to pay. No billing code until the validation milestone and explicit approval.

## Decisions made autonomously (low risk)

- Basic progression is double progression with a 5 lb default step. Configurable later; a method, not a law.
- Rest default by rep range: 180s (<=6), 120s (<=10), else 90s. Adjustable per timer.
- The "active plan" is the plan of the unfinished session, else the last chosen, else the newest.
- Volume is shown but labeled as not a measure of strength or muscle gain.
- No new dependencies. Tests use Node's built-in runner.

## Deviations from the founder brief

- The brief suggests $4.99/$39.99; competitive evidence supports that over my earlier $8/$65 suggestion.
- Phase 0 research is partial (see evidence table). I did not fill gaps with guesses.
- Visual redesign, brand accent and logo are deferred; the Log page uses the existing black and green look so nothing is rebranded without approval.

## Roadmap

Full requirements for the exercise library are in `exercise-library-addendum.md` (founder addendum, 2026-11-02).

1. **Phase 1 (this checkpoint):** secure, reliable logging. Log page, rotation, previous, target, rest timer, resume, summary.
2. **Security patch:** Next.js 16.4.3 on its own branch (see audit.md).
3. **Phase 2: exercise library foundation.** Stable exercise ids and a canonical model, mapping of the existing 149 exercises, source and license comparison (RepDB, Free Exercise DB, wger), one reusable picker for Plan and Log. Also fixes audit finding 7 (exercises referenced by name). Nothing is imported into production, and no third-party dataset is committed to the public repo, until the licenses are read and you approve the strategy.
4. **Phase 3: library expansion and search.** Reviewed import (target 700-1,000+, but the published count is only what passes validation), typo-tolerant search with aliases and filters, recents/favorites, private custom exercises, intelligent substitution, exercise detail view, a reviewed "eligible for plan generation" subset.
5. **Phase 4: onboarding questionnaire** and generated plan preview, selecting only from the reviewed subset.
6. **Phase 5:** flexible rotation (skip, pause), optional RIR, comparable-session logic, more progression tests.
7. **Phase 6:** export, charts, PR history, offline resilience, design system, accessibility pass.
8. **Phase 7:** beta with 20-30 lifters. **Phase 8:** billing, only if validated.

Why the library comes before onboarding: the generator should not pick from a messy catalog, and changing exercise identity later would put every user's history at risk. Doing ids first is the safer order. If you would rather have the questionnaire sooner, it can ship first using the existing templates and be re-pointed at the reviewed subset afterward.
