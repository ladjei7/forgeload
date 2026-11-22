#!/bin/sh
# The push function (Deno, on Supabase) uses the same pure rules as the app. Copy them in, unchanged.
# tests/pushShared.test.ts fails if the copies drift.
set -e
cd "$(dirname "$0")/.."
for f in reminders schedule rotation rules; do cp "app/lib/$f.ts" "supabase/functions/push/shared/$f.ts"; done
