# Exercise library: impact assessment, source comparison, import strategy

Date: 2026-11-02. Requirements: `docs/product/exercise-library-addendum.md`. Status: **assessment only. Nothing has been imported or changed in the database.**

## 1. What the current code does (and why it matters here)

| Current behavior | Consequence for a 700-1,000+ exercise library |
|---|---|
| `plan_exercises.exercise_name` and `exercise_logs.exercise_name` store the exercise as a **text name**. The Log page matches previous performance by that name. | Renaming, merging or cleaning a catalog name splits or loses history. Stable ids are required **before** any import. |
| `templates.ts` resolves template exercises to library names by fuzzy text match when a plan is created. | Must point at canonical ids instead. |
| `ExercisePicker` loads the whole `exercises` table in one query, no limit. | The API typically caps a response at 1,000 rows (verify in project settings), so a bigger catalog plus custom exercises could be **silently truncated**. Needs server-side search with paging. |
| `exercises` has only name, muscle_group, equipment, user_id. Custom exercises are created as muscle "Other", equipment "Other". | Needs the canonical fields in the addendum (aliases, secondary muscles, movement pattern, tracking type, load convention, status, source). |
| `exercise_sets` stores only `reps` and `weight`. The Log page and `suggestTarget` assume weight x reps. | Duration, distance and assisted/added-weight exercises need new columns and tracking-type-aware logging and targets. Until then, non-weight exercises should not get a progression target. |
| History volume = weight x reps. | Must skip or handle other tracking types. |
| Whether users can edit or delete built-in rows (user_id NULL) depends on RLS policies I have not re-tested. | Must be tested before custom-exercise editing ships. |

## 2. Proposed model (additive, nothing dropped)

- Extend `exercises` with: `aliases text[]`, `secondary_muscles text[]`, `movement_pattern`, `category`, `mechanic` (compound/isolation), `level`, `is_unilateral`, `tracking_type` (enum: weight_reps, bodyweight_reps, added_weight_reps, assisted_reps, duration, weight_duration, distance_duration), `load_convention` (total, per_hand, per_side, per_implement), `instructions`, `source`, `source_id`, `source_version`, `review_status`, `plan_eligible boolean default false`, `archived_at`.
- Add nullable `exercise_id` to `plan_exercises` and `exercise_logs`. Backfill by **exact** name match to the existing 149; leave unmatched rows NULL for manual review. Keep `exercise_name` as the snapshot shown in history, so old logs never change.
- Add `exercise_sets.duration_seconds` and `distance_m` (nullable).
- Add `user_exercise_prefs` (favorite, last_used_at) for favorites and recents.
- Add `exercise_substitutions` (from, to, similarity note) as reviewed data, not auto-generated.
- Search: enable `pg_trgm`, add a `tsvector` and an alias match, expose one `search_exercises(query, muscle, equipment, limit)` RPC that runs with the caller's RLS. No external search service.

## 3. Source comparison

Facts below come from the repo pages (2026-11-02). RepDB's full free-tier license (v1.0) was supplied by the owner and is reviewed in section 6. This is not legal advice.

| | RepDB (free) | Free Exercise DB | wger |
|---|---|---|---|
| Size | 701 | "800+" | Not stated |
| Metadata | Rich: category, force, mechanic, difficulty, equipment, body part, primary/secondary muscles, goals, tags, unilateral and bodyweight flags, EN/DE/ES instructions and tips | Good: force, level, mechanic, equipment, primary/secondary muscles, instructions, category. Some fields can be null. | Not assessed |
| Media | 512x512 flat WebP, start/peak poses | Images in repo; **origin not stated** | Per-entry licenses |
| License | Free for personal and commercial **in-app** use; attribution required; no redistribution as a dataset, repo or API; images not usable for generative AI | "Unlicense" badge (public domain). Provenance of images and of the original text **unverified**. | Code AGPL-3.0; exercise data "Creative Commons, see individual entries"; share-alike licenses possible |
| Fit | Best structured data for our model | Good supplement for gaps | Highest license risk (share-alike, per-entry) |
| Not used | ExerciseDB API (per your instruction) | | |

## 4. Recommended strategy (needs your approval)

1. **Primary source: RepDB free, conditional** on reading the full `LICENSE-DATA.md` and confirming that storing records in our own database behind login, with visible attribution, is within "in-app use".
2. **Supplement: Free Exercise DB, data only,** after spot-checking provenance. No images from it unless their origin is established.
3. **Skip wger** for now.
4. **The repo is public.** Raw datasets, converted dataset files and images must never be committed. The import script lives in the repo; the data and its output are gitignored and processed on your computer or in Supabase only.
5. **No bulk endpoint.** Catalog reads go through the authenticated search RPC with paging. Images go in a private storage bucket with listing disabled and are served per exercise.
6. Show "Exercise data by RepDB (repdb.co)" in the app, plus an attribution file, for any RepDB-sourced entry.
7. Pipeline (reproducible, versioned): load raw -> validate schema -> normalize muscle/equipment taxonomy -> canonical naming -> detect duplicates against the 149 and across sources -> map or add -> write a report. Report buckets match the addendum: raw, accepted, rejected, merged, existing preserved, needs review, approved for plan generation. **Published count = only what passes validation.**
8. Existing 149: map to canonical entries by reviewed mapping CSV. Never auto-merge exercises with different biomechanics or loading. Unmapped rows stay as they are.
9. Run order: additive schema migration -> backfill ids -> import into a **staging** table -> review report -> you approve -> promote. Rollback: imports carry `source_version`, so a version can be removed without touching user rows.

## 5. Impact on the existing roadmap

- Stable exercise ids move from Phase 3 to the start of the library phase.
- Plan generation (onboarding) moves after the library and the reviewed `plan_eligible` subset.
- Progression targets stay weight x reps only until tracking-type-aware logic exists.
- The Phase 1 Log page needs no rework; it will switch from name to id matching when ids land.

## 6. RepDB free license (v1.0) review

Verdict: **compatible with an in-app catalog, with the conditions below.** Not legal advice.

| Term | What it means for ForgeLoad |
|---|---|
| 1. Free commercial in-app use | OK. Storing records in our database and showing them in the app is in-app use. |
| 2. Visible attribution | Required: a visible "Exercise data by RepDB (repdb.co)" link on an about/credits screen or site footer. We will add a credits screen before any RepDB data ships. |
| 3. No redistribution as a dataset or API | **The main risk.** Our public repo must never contain RepDB data, images, or files derived from them (including mapping reports that list their records). Catalog access goes through an authenticated, paged search function with a result cap and no "list everything" endpoint. Data export must contain only the user's own logs, not catalog metadata. Anyone who can sign up can still query the app, so this reduces rather than removes the exposure; a one-line confirmation from RepDB support is recommended. |
| 4. Image edits | Resize, crop, recolor for in-app use is allowed (thumbnails are fine). Derivatives stay under term 3. |
| 5. No generative-AI use of images | No image goes into any AI tool, including for quality review. Image checks are deterministic only (file exists, dimensions, format). Any future original demonstrations must not be derived from these images. |
| 6. Premium preview animations | Excluded. The importer ignores the `premium-samples/` folder. |
| 7. No warranty, not medical advice | Keep a not-medical-advice notice near instructions. |

Other notes: record the license version and date in each imported row's source metadata. Images are stated to be original AI-generated works commissioned by RepDB, so our rights rest on their contract, not on copyright we can verify ourselves. Paid tiers remove the attribution requirement if ever wanted.

## 7. Decisions and inputs needed from you

1. ~~Send the RepDB license.~~ Received and reviewed above.
2. Approve RepDB (free) as the primary source under the conditions in section 6.
3. Optional but recommended: email support@repdb.co to confirm that an authenticated, paged in-app search over their data in our own database counts as in-app use.
4. Confirm you are comfortable running one local import command on your computer when we reach that step (it needs your Supabase service key, which must never go in chat or in the repo).

## 8. Status: Phase 2A (exercise identity) built, not merged

Branch `phase-2a-exercise-ids`. Migration `002_exercise_identity.sql` adds the canonical columns, `exercise_id` on plans and logs (backfilled only on an exact, unambiguous name match), a database-side `search_exercises` function (abbreviations, aliases, typo tolerance, ranking, 50-result cap), and restrictive policies so built-in exercises cannot be edited or deleted by users. The picker, Plan page, templates and Log history now use ids; Log keeps matching older rows by name.

Verified: 20 database checks on a local Postgres 16 (backfill, search, isolation, protection, anon denied), migration re-run is harmless, search takes 8-20 ms on 816 synthetic rows (database time only), plus browser tests of Plan and Log against a simulated API. **Not verified:** the real Supabase project, a real phone, or the real catalog. No third-party data has been imported. Muscle/equipment filter chips, favorites, recents and the standalone library screen are not built yet.

## Phase 2B status: library UI (branch `phase-2b-library-ui`)

Built: muscle and equipment filter chips (data from `exercise_facets()`), favorites and recents (`user_exercise_prefs`, migration 003), picker shortcuts, a `/library` page (search, All/Favorites/Recent/Mine tabs, load more, favorite star, details), custom exercise create/edit/duplicate/archive/restore (private, duplicate names blocked), and Log support for bodyweight and per-hand/per-side exercises.

**Before the preview works:** run `supabase/migrations/003_exercise_prefs.sql` once in the Supabase SQL Editor (additive, rollback in file).

Verified locally: 17 unit tests, 24 + 18 SQL checks on a fresh Postgres, production build, and browser tests against a simulated API (library paging, filter, favorite, create + validation; plan picker; log flow; empty-day rotation).
Not verified: real Supabase project, a physical phone, the full catalog (still the existing ~149 exercises).


## Phase 4 start: RepDB confirmed (2026-11-02)

RepDB support (Sergei) replied in writing to the owner's question. Summary, not a quote:
- Storing records and images in our own Supabase database and showing them to signed-in users is in-app use under free license v1.0.
- Authenticated, paged search is fine. We must not offer a public endpoint or bulk export of the records or images.
- Keep the data out of the public repo and out of any public storage bucket.
- No generative-AI use of images. Images may be resized, cropped or recolored for in-app use.
- Attribution: a visible link "Exercise data by RepDB (https://repdb.co/)" on an about/credits screen, README or website footer; rel="nofollow" is allowed.

Decision: RepDB (free) is the primary source. Free tier is the preview bundle (about 169 MB, JSON/SQL/TypeScript, no signup). Fields per RepDB's site: id, name, description, instructions, tips, category, difficulty, equipment, body_part, primary/secondary muscles, goals, tags, variation_group, relations, images. The importer must work from what is actually in the bundle, and published counts will only include entries that pass validation.

Plan: (1) credits screen with the attribution link, before any data ships; (2) local importer that reads the bundle from the owner's computer, writes a dry-run report and a SQL file locally (both gitignored, no service key needed), mapping exact normalized name matches onto existing built-ins and creating new rows otherwise; (3) owner reviews counts, then runs the SQL; (4) images as a separate step, in a private bucket with signed URLs only.
