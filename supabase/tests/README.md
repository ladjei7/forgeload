# Database tests (local only)

These run against a throwaway local Postgres, never against production. They use a small
fixture that imitates Supabase (`auth.uid()`, roles, RLS) and made-up sample exercises.

```
createdb t
psql t -v ON_ERROR_STOP=1 -f supabase/tests/fixture.sql
psql t -v ON_ERROR_STOP=1 -f supabase/migrations/001_session_state.sql
psql t -v ON_ERROR_STOP=1 -f supabase/tests/exercise_identity_test.sql   # applies 002 itself
```

For the favorites/recents test, start from a fresh database: fixture, 001, 002, then
`psql t -v ON_ERROR_STOP=1 -f supabase/tests/exercise_prefs_test.sql` (it applies 003 itself).

Covers: id backfill (exact only, nothing guessed), search (abbreviations, typos, ranking,
filters, result cap), per-user isolation of custom exercises, built-ins protected from edit,
insert and delete, and that anonymous users cannot call search.
