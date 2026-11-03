# Exercise library import (RepDB free tier)

Licence: free for in-app use including commercial, with a visible "Exercise data by RepDB (repdb.co)" link (now in Settings). No redistribution as a dataset, repo or API. No generative-AI derivation.

## What is in the repo
Rules only: `scripts/repdb/map.ts` (mapping), `scripts/repdb/build-sql.ts` (generator), tests with invented fixtures. **No RepDB data, text or images are committed.** `.gitignore` blocks `/data/` and `repdb*`, and the generator refuses to write inside the repo.

## How to run (on your computer; no keys, no network)
1. Run `006_library_comfort_and_prefs.sql` in the Supabase SQL Editor (adds `comfort_level` and a unique index on source + source id).
2. `node scripts/repdb/build-sql.ts "<path>\free.en.json" "<folder outside the repo>"`
3. Paste `repdb-01.sql` to `repdb-12.sql` into the SQL Editor in order. Each is one transaction and safe to run twice.

## What the import does
- Existing built-in exercises with the same name get source fields and missing metadata filled in. Names, ids and your history are never changed. Everything else is inserted as a built-in row (`user_id` null).
- Every row is `review_status = 'imported'`, `plan_eligible = false`. The generator only uses reviewed exercises, so importing changes nothing about generated plans until we review.
- Mapping: equipment to comfort level (machine and cable 1, dumbbell and kettlebell 2, barbell and hanging bodyweight 3, unknown left empty). Movement pattern is conservative: clear names only, otherwise empty. Muscle group prefers quads or hamstrings over glutes for squats and hinges.

## Known limits
- The movement pattern is a name-based guess for about half the rows and is not trusted for plans until reviewed.
- Images are not imported. They must not go in `public/` (that would publish them). Plan: a private Supabase Storage bucket readable by signed-in users only.
- If built-in exercises are readable with the public anon key, anyone could pull the whole set through the API. Restrict reads to signed-in users before beta.

## After the import: curation and real-app wiring
- `008_curate_plan_eligible.sql` marks 42 hand-reviewed exercises plan-eligible with reviewed pattern and comfort level (the machine, dumbbell and barbell versions the comfort question chooses between). Run it after the import. It should report 42.
- Real app: `/start` now asks the comfort question and builds the starter plan through `app/lib/comfort.ts` (lookup tables, 5 tests). Comfort is saved best-effort to `user_training_prefs` and never blocks plan creation. Every swapped exercise shows "Instead of ...".
- `supabase/diagnostics/exercise_read_policies.sql` is read-only. Run it and paste the result so we can restrict reads of the library to signed-in users without breaking login or search.
- Still prototype-only: suggestions (`adapt.ts`), the Free/Pro demo, and the Home suggestion card. They move into the real app next, Free rules first.
