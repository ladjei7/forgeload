#!/bin/sh
# Builds the single-file bundle that is deployed as the Supabase Edge Function "push"
# (source: supabase/functions/push/index.ts + shared/, which are copies of app/lib rules).
set -e
cd "$(dirname "$0")/.."
./scripts/sync-push-shared.sh
npx --yes esbuild@0.24.0 supabase/functions/push/index.ts --bundle --format=esm --platform=neutral --target=es2022 \
  "--external:npm:*" "--external:jsr:*" --legal-comments=none --outfile="${1:-/tmp/push-bundle.ts}"
echo "Deploy the output as function 'push' with verify_jwt = false (it checks sign-in itself)."
