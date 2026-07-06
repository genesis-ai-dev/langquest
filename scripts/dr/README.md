# DR: in-place PITR + erasure gate

In-place restore only. Do not reopen client traffic until the erasure gate completes.

The canonical external `account_erasure` ledger lives in **Neon Postgres**, not Cloudflare D1
(decision 20 / [LQ-49](https://linear.app/frontierrandd/issue/LQ-49/ship-gdpr-compliance-in-one-sprint) C8a).

Context and checklist: [LQ-49 — Ship GDPR compliance in one sprint](https://linear.app/frontierrandd/issue/LQ-49/ship-gdpr-compliance-in-one-sprint) (C8 erasure gate, purge order, backup copy policy).

PITR restore: [Database → Backups → Point in Time](https://supabase.com/dashboard/project/_/database/backups/pitr).

## Secrets (dotenvx)

Preview and production tokens live in encrypted env files. Private keys are in `supabase/.env.keys` (same as other Supabase env files — not committed).

| File | Env |
| --- | --- |
| `scripts/dr/.env.preview` | preview |
| `scripts/dr/.env.production` | production |

Set tokens once per file (requires `supabase/.env.keys` on your machine):

```bash
npx dotenvx set SUPABASE_ACCESS_TOKEN "sbp_..." -fk supabase/.env.keys -f scripts/dr/.env.preview
npx dotenvx set PS_ADMIN_TOKEN "..." -fk supabase/.env.keys -f scripts/dr/.env.preview
npx dotenvx encrypt -fk supabase/.env.keys -f scripts/dr/.env.preview -ek SUPABASE_REF -ek POWERSYNC_INSTANCE_ID

npx dotenvx set SUPABASE_ACCESS_TOKEN "sbp_..." -fk supabase/.env.keys -f scripts/dr/.env.production
npx dotenvx set PS_ADMIN_TOKEN "..." -fk supabase/.env.keys -f scripts/dr/.env.production
npx dotenvx encrypt -fk supabase/.env.keys -f scripts/dr/.env.production -ek SUPABASE_REF -ek POWERSYNC_INSTANCE_ID
```

Commit the encrypted `.env.preview` / `.env.production` after `dotenvx set` + `encrypt`.

## External ledger (Neon)

`account_erasure` is replicated **Supabase → Neon only** so the suppression list
survives an in-place PITR rollback of the Supabase project.

- **Default:** logical replication. Publication `gdpr_pub` on Supabase uses
  `publish = 'insert, update, truncate'` — **DELETE is excluded** so a PITR rollback
  or an accidental delete on Supabase never removes rows from the canonical Neon copy.
  Slot `gdpr_slot` on Supabase; subscription `gdpr_sub` on Neon (direct connection,
  `create_slot = false`, `slot_name = 'gdpr_slot'`).
- **Fallback:** `postgres_fdw` foreign table + `pg_cron` batch pull on Neon every
  5–10 minutes (`ON CONFLICT (auth_user_id) DO NOTHING`) when minutes of lag are acceptable.

Separate Neon database per environment (preview / production). Do **not** use Cloudflare D1.

## 1. Freeze clients

**Before freezing, confirm the Neon ledger is caught up:** replication lag zero (default)
or Neon/Supabase `account_erasure` row counts match (FDW fallback). Only then stop clients.

```bash
npm run dr:freeze-clients          # preview
npm run dr:freeze-clients:prod     # production
```

`freeze-clients.sh` stops PowerSync sync and disables the Supabase Data API. It does not
touch the ledger — Neon is kept current continuously by logical replication (or the FDW +
`pg_cron` pull), so a caught-up Neon is the pre-freeze gate.

## 2. Restore in Supabase dashboard

1. Open [PITR](https://supabase.com/dashboard/project/_/database/backups/pitr) for the target project.
2. Pick a recovery point within the PITR window.
3. Confirm **in-place restore**. The database is offline during restore.

## 3. Erasure gate (before unfreezing)

After restore completes, while clients are still frozen:

1. Union the **Neon** `account_erasure` ledger with rows in the restored Supabase database.
2. Re-purge any resurrected UUIDs still in `auth.users` / `profile`.
3. Verify zero hits; log counts.

See **Account purge → Backups and restore suppression (C8)** in [LQ-49](https://linear.app/frontierrandd/issue/LQ-49/ship-gdpr-compliance-in-one-sprint).

If resurrected PII was reachable in production before the gate finished, follow the breach runbook linked from LQ-49.

## 4. Unfreeze clients

```bash
npm run dr:unfreeze-clients          # preview
npm run dr:unfreeze-clients:prod     # production
```

Redeploys PowerSync and re-enables the Data API. Check replication lag in the [PowerSync dashboard](https://dashboard.powersync.com/) before treating traffic as healthy.
