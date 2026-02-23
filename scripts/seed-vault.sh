#!/bin/bash
# Seeds Supabase Vault secrets required by database triggers (e.g. handle_invite_trigger).
# Idempotent — safe to run multiple times.

set -euo pipefail

# Read env vars from .env.local
SUPABASE_URL=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)
SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "⚠️  Could not read EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY from .env.local"
  echo "   Run 'npm run generate-env' first."
  exit 1
fi

echo "🔑 Seeding Vault secrets..."

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_url') THEN
    PERFORM vault.create_secret('$SUPABASE_URL', 'supabase_url');
    RAISE NOTICE 'Created vault secret: supabase_url';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_service_role_key') THEN
    PERFORM vault.create_secret('$SERVICE_ROLE_KEY', 'supabase_service_role_key');
    RAISE NOTICE 'Created vault secret: supabase_service_role_key';
  END IF;
END \$\$;
SQL

echo "✅ Vault secrets ready"
