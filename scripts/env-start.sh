#!/bin/bash
# Starts the full local dev environment:
#   1. Supabase (DB, Auth, Storage, etc.)
#   2. Vault secrets (for invite trigger)
#   3. Edge Functions (background)
#   4. PowerSync (foreground — Ctrl+C to stop)

set -euo pipefail

FUNCTIONS_PID=""

cleanup() {
  echo ""
  echo "🛑 Stopping edge functions..."
  if [ -n "$FUNCTIONS_PID" ]; then
    kill "$FUNCTIONS_PID" 2>/dev/null || true
    wait "$FUNCTIONS_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "🚀 Starting Supabase..."
npm run supabase start

echo ""
bash scripts/seed-vault.sh

echo ""
echo "⚡ Starting Edge Functions (background)..."
npm run supabase:serve-functions &
FUNCTIONS_PID=$!

echo ""
echo "🔄 Starting PowerSync (Ctrl+C to stop everything)..."
npm run powersync:start
