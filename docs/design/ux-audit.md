# Forgeload UX audit (2026-11-02)

Scope: the live app at commit 3404dc6, reviewed from code and from phone-width (390 px) screenshots against a simulated API with sample data. Not yet done: a physical-phone pass, screen-reader pass, or tests with real lifters. Findings are marked **Usability** (affects getting a task done or data safety) or **Aesthetic** (taste).

## What works and should be kept
- Log page structure: target with a "why?" explanation, previous performance, one-tap logging of the suggested set, undo by tapping a done set, auto rest timer, draft recovery, resume of an unfinished workout.
- "Up next" rotation model (independent of weekday) and the no-shame empty-day handling.
- Search behavior in the library (abbreviations, typo tolerance, filters, favorites, recents).
- Dark base, green as the "go" color, large primary buttons on Home and Log.

## Findings

| # | Type | Finding | Evidence |
|---|---|---|---|
| 1 | Usability | **No design tokens, two styling systems.** Plan, History, Login, Exercise picker and the nav use inline `style={{}}`; Home, Log, Library, Start and Settings use Tailwind classes. About 230 hardcoded hex values across 10 files. Any restyle means touching every screen by hand. | `grep` counts per file |
| 2 | Aesthetic/Usability | **No real typeface.** `globals.css` references Geist variables but `layout.tsx` never loads them, and the body sets Arial/`sans-serif`. Numbers are not tabular, so weights and reps do not align. | `layout.tsx`, `globals.css` |
| 3 | Usability | **Navigation has no active state** (every tab is white) and uses emoji icons. Library is not in the nav. Log tab gives no sign that a workout is in progress. A tap on Home/Plan during a workout leaves the session with no persistent way back. | `BottomNav.tsx` |
| 4 | Usability | **Primary action color is inconsistent:** white "Start workout" on Log, green on Home. Users learn one meaning for a primary button. | screenshots |
| 5 | Usability | **Browser `confirm()` / `prompt()` used 9 times** (rename plan/day, discard workout, archive, delete). They cannot be styled, are easy to dismiss by accident on mobile, and some in-app browsers block them. | `grep` |
| 6 | Usability | **Plan page is one long scroll of seven cards.** Template picker is first even for someone who already has a plan; destructive "Delete" sits right next to "Rename". Creating and editing a program are mixed on one screen. | `plan.png` |
| 7 | Usability | **Set states are only "empty" and "done".** There is no distinct pending-save, failed-save, skipped or active-set state. A failed save shows as a banner at the top, away from the set. The brief asks the user to always know whether a set was recorded. | `log/page.tsx` |
| 8 | Usability | **Log rows are a desktop-style 5-column table** at 390 px. Inputs are about 54 px wide; Previous is truncated to a small gray string. Works, but tight on 320-360 px phones (not yet measured on a real device). | `log.png` |
| 9 | Aesthetic | **Home stats cards** ("3 workouts, last 7 days" / "3 total") do not drive an action. The brief's hierarchy (Next workout first, then context) is already roughly followed, but the stat tiles are the weakest content. | `home.png` |
| 10 | Usability | **Contrast.** Muted text `#777` on `#111` is 4.2:1 (below the 4.5:1 AA line for body text), nav labels `#666` on `#111` are 3.3:1, input placeholders 2.3:1. Green `#4ade80` and the black-on-green button pass comfortably (10.8 and 12.1). | calculated |
| 11 | Usability | **No light mode** (body forces black despite a `prefers-color-scheme` block). The brief asks for a bright-gym option. | `globals.css` |
| 12 | Usability | **Focus visibility is inconsistent:** Tailwind pages have focus rings, the inline-style pages do not. | code review |
| 13 | Usability | **Desktop is a centered phone column** (max 576-600 px). Acceptable now, but not an intentional large-screen layout. | screenshots |
| 14 | Safety | Data-loss risks are mostly handled: drafts persist per session, sets save immediately, discard and delete confirm. Remaining: plan edits apply instantly with no undo, and the confirm dialogs are the weak guard noted in #5. | code review |

## Reusable pieces that already exist
`ExerciseFilters`, `ExercisePicker`, `BottomNav`, `lib/progression.ts` (the "why" text), `lib/rotation.ts`, `lib/templates.ts`, `lib/recommend.ts`. No shared button, card, input, sheet or chip components exist yet; each page re-declares its class strings.

## Implication for the redesign
The largest win is structural, not cosmetic: one token layer plus a handful of shared components (Button, Card, NumberField, SetRow, Sheet, Tabs, NavBar), then restyle screen by screen. The Log screen deserves the most design effort and should be validated with real use before the rest follows.
