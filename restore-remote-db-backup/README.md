# Database Recovery - Restore Backup & Re-apply Migrations

Simple guide to extract recent data, restore an old backup, revert migrations, re-run them correctly, and restore your data.

## Problem

Four migrations need to be re-applied correctly after restoring a 2-day-old backup:
- `20251001124000` - Language/region tables
- `20251008120001` - Schema restructuring  
- `20251017000000` - Quest metadata
- `20251017000001` - Metadata encoding fix

## Quick Start

```bash
# 1. Set connection (use port 6543 and pgbouncer=true)
export DB_CONN="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"

# 2. Test connection
psql "$DB_CONN" -c "SELECT current_database();"

# 3. Extract recent data
psql "$DB_CONN" -f extract_recent_data.sql > extracted_data.sql

# Verify extraction worked
wc -l extracted_data.sql
grep -c "INSERT INTO" extracted_data.sql
```

**Then follow the 7 steps below.**

---

## The 7 Steps

### Step 1: Extract Recent Data ✅ (Done)

You've already done this with the command above. You should have `extracted_data.sql` with your recent data.

**Verify:** File should have ~150 lines with INSERT statements for your 2 projects, 4 quests, and 6 assets.

### Step 2: Create Safety Backup (15 min)

⚠️ **Critical safety step before making destructive changes**

**Via Supabase Dashboard:**
1. Go to Database → Backups
2. Click "Create backup"
3. Wait for completion
4. Note the backup ID

### Step 3: Restore Old Backup (30 min)

⚠️ **This is destructive - no turning back after this**

**Via Supabase Dashboard:**
1. Go to Database → Backups
2. Find backup from **2 days ago**
3. Click Restore
4. Wait for completion
5. Verify restoration succeeded

### Step 4: Mark Migrations as Reverted (1 min)

```bash
psql "$DB_CONN" <<EOF
-- Verify what's currently applied
SELECT version FROM supabase_migrations.schema_migrations 
WHERE version >= '20251001124000' ORDER BY version;

-- Delete the 4 migrations
DELETE FROM supabase_migrations.schema_migrations 
WHERE version IN (
  '20251001124000',
  '20251008120001', 
  '20251017000000',
  '20251017000001'
);

-- Verify they're gone (should show 0 rows)
SELECT version FROM supabase_migrations.schema_migrations 
WHERE version >= '20251001124000';
EOF
```

### Step 5: Re-run Migrations (5 min)

```bash
cd /Users/ryderwishart/frontierrnd/langquest
supabase db push
```

**Verify:** All 4 migrations should apply successfully with no errors.

### Step 6: Restore Extracted Data (10 min)

```bash
cat restore_extracted_data.sql extracted_data.sql | psql "$DB_CONN"
```

**Watch for:**
- Transaction begins
- INSERT statements execute (some may skip with ON CONFLICT - that's fine)
- Transaction commits
- Summary statistics display

### Step 7: Verify Success (5 min)

```bash
# Check migrations are applied
psql "$DB_CONN" -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20251001124000' ORDER BY version;"

# Should show all 4 migrations

# Check recent data is present
psql "$DB_CONN" <<EOF
SELECT COUNT(*) as projects FROM public.project WHERE created_at >= NOW() - INTERVAL '2 days';
SELECT COUNT(*) as quests FROM public.quest WHERE created_at >= NOW() - INTERVAL '2 days';
SELECT COUNT(*) as assets FROM public.asset WHERE created_at >= NOW() - INTERVAL '2 days';
EOF
```

**Test your application** - verify everything works!

---

## Files in This Directory

| File | Purpose |
|------|---------|
| `README.md` | This guide |
| `extract_recent_data.sql` | Script to extract recent data |
| `extracted_data.sql` | Your extracted data (generated) |
| `restore_extracted_data.sql` | Wrapper for safe restoration |
| `backup_restore.sql` | Deprecated old file (ignore) |

---

## Troubleshooting

### Connection Timeout

**Problem:** `psql` times out connecting to Supabase

**Solution:** Use port **6543** (not 5432) with pgbouncer:
```bash
export DB_CONN="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
```

### "Column created_at does not exist"

**Problem:** Some tables don't have `created_at` column

**Solution:** These are computed tables (closures, maps) - they're already skipped in the script.

### "Relation does not exist"

**Problem:** Table doesn't exist in your database

**Solution:** Optional system tables are already commented out. If you see this for other tables, the extraction script may need updating.

### Duplicate Key Errors

**Problem:** Data already exists from backup

**Solution:** All INSERT statements include `ON CONFLICT DO NOTHING` - they should skip automatically. If you still see errors, the backup may already include that data.

### Foreign Key Violations

**Problem:** Parent records missing during restoration

**Solution:** `restore_extracted_data.sql` uses deferred constraints. Make sure you're using the combined command:
```bash
cat restore_extracted_data.sql extracted_data.sql | psql "$DB_CONN"
```

---

## Rollback Plan

| Stage | Rollback Action |
|-------|----------------|
| Before Step 3 | Stop - you're safe, nothing destructive yet |
| After Step 3 | Restore the safety backup from Step 2 |
| During Step 6 | Press Ctrl+C to cancel transaction before COMMIT |
| After Step 6 | Restore safety backup and start over |

---

## Technical Notes

### What Gets Extracted

**Extracted (from last 2 days):**
- Auth tokens and sessions
- Projects, quests, assets
- Tags, votes, reports
- Link tables
- User profiles

**Skipped (automatically regenerated):**
- `project_closure` / `quest_closure` (computed tables)
- `map_*` tables (80,000+ metadata records - regenerated automatically)
- `project_rollup_progress` (tracking table)
- Optional system tables that don't exist

### Safety Features

- **Idempotent INSERTs:** All include `ON CONFLICT DO NOTHING`
- **Deferred constraints:** Handles circular dependencies
- **Transaction-based:** All-or-nothing restoration
- **Trigger management:** Prevents side effects during restore

### Time Estimates

- **Preparation:** 10-25 min (Steps 1-2)
- **Destructive phase:** 10-30 min (Steps 3-4) ⚠️ No turning back
- **Restoration:** 20-40 min (Steps 5-7)
- **Total:** 40-95 minutes

---

## Success Checklist

After completion, verify:
- [ ] All 4 migrations show in `schema_migrations`
- [ ] Recent data (last 2 days) visible in database
- [ ] Application loads without errors
- [ ] Can view projects, quests, assets
- [ ] No foreign key constraint errors
- [ ] User authentication works
- [ ] Can create new content

---

## Need Help?

Common issues are in the **Troubleshooting** section above. For other problems:

1. Check error messages carefully
2. Verify you're at the correct step
3. Review the commands you ran
4. Check connection string is correct (port 6543!)
5. If restoration failed, use rollback plan

**Remember:** Steps 1-2 are safe. Step 3+ is destructive. Make sure Step 1 completed successfully before proceeding!

