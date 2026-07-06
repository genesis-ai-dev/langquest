#!/usr/bin/env bash
set -euo pipefail
npx --yes powersync@latest stop --instance-id "$POWERSYNC_INSTANCE_ID" --confirm=yes
curl -sS -X PATCH "https://api.supabase.com/platform/projects/${SUPABASE_REF}/config/postgrest" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"db_schema":"","max_rows":1000,"db_extra_search_path":"public, extensions"}'
