# Client-Side Schema Migrations

This directory contains client-side schema migrations for the LangQuest app. When users update the app with a new schema version, migrations automatically run on their local SQLite database to transform existing data.

## Overview

### Why Client-Side Migrations?

- **Local-only data**: Users can create data offline that never hits the server
- **Schema evolution**: As the app evolves, local data structures need to change
- **Zero data loss**: Migrations ensure existing data is preserved and transformed correctly
- **Automatic**: Users don't need to manually update their data

### How It Works

1. **Version Detection**: Each record has `_metadata.schema_version` field
2. **Startup Check**: App checks if any `*_local` table records have outdated versions
3. **Migration UI**: If needed, shows fullscreen migration screen with progress
4. **Sequential Execution**: Runs migrations in order (1.0 → 1.1 → 1.2)
5. **Metadata Update**: Updates all `_metadata` in `*_local` tables to current version
6. **Continue**: App proceeds normally after successful migration

### Important: Local Tables Only

**We only migrate `*_local` tables, NOT synced tables!**

- **Synced tables** are migrated server-side via RPC (`ps_transform_v1_to_v2` in Supabase)
- When local data is uploaded, the server automatically transforms it
- **Local tables** contain unpublished data that needs client-side migration
- Migrating synced tables would create conflicts with server-side migrations

**Migration targets:**
- ✅ `asset_local`, `quest_local`, `project_local`, etc.
- ❌ `asset`, `quest`, `project`, etc. (synced - handled by server)

## Creating a Migration

### Step-by-Step Process

#### 1. Update Schema

Make your changes to the Drizzle schema in `db/drizzleSchemaColumns.ts`:

```typescript
// Example: Add a new field
export function createAssetTable(source: TableSource, refs: {...}) {
  return tableCreator(source)('asset', {
    ...getBaseColumns(source),
    // ... existing fields ...
    new_field: text(), // NEW FIELD
  });
}
```

#### 2. Bump Schema Version

Update `APP_SCHEMA_VERSION` in `db/drizzleSchema.ts`:

```typescript
export const APP_SCHEMA_VERSION = '1.1'; // Changed from '1.0'
```

#### 3. Create Migration File

Create a new migration file (e.g., `1.0-to-1.1.ts`):

```typescript
import type { DrizzleDB } from '@powersync/drizzle-driver';
import type { Migration } from './index';
import { addColumn } from './utils';

export const migration_1_0_to_1_1: Migration = {
  fromVersion: '1.0',
  toVersion: '1.1',
  description: 'Add new_field to assets',

  async migrate(db, onProgress) {
    onProgress?.(1, 2, 'Adding new column');
    
    // ONLY add to local table - server handles synced tables
    await addColumn(db, 'asset_local', 'new_field TEXT DEFAULT NULL');
    // DO NOT migrate 'asset' table - server RPC handles this
    
    onProgress?.(2, 2, 'Migration complete');
  }
};
```

#### 4. Register Migration

Add your migration to the registry in `db/migrations/index.ts`:

```typescript
import { migration_1_0_to_1_1 } from './1.0-to-1.1';

export const migrations: Migration[] = [
  migration_1_0_to_1_1,
  // Future migrations go here...
];
```

#### 5. Test Migration

**Critical**: Test with real data before deploying!

```typescript
// Create test data with old version
const testDb = ...;
await testDb.insert(asset_local).values({
  id: uuid.v4(),
  _metadata: { schema_version: '1.0' },
  // ... other fields
});

// Run migration
const result = await runMigrations(testDb, '1.0', '1.1');
console.log(result); // Check for success

// Verify transformed data
const records = await testDb.select().from(asset_local);
console.log(records[0]._metadata); // Should be { schema_version: '1.1' }
console.log(records[0].new_field); // Should have value
```

#### 6. Deploy

Once tested:
1. Merge PR with schema changes + migration
2. Build and release new app version
3. Users automatically migrate on next app start

## Migration Utilities

The `utils.ts` file provides helper functions for common tasks:

### Schema Operations

```typescript
// Add a column
await addColumn(db, 'table_name', 'new_column TEXT DEFAULT NULL');

// Rename a column
await renameColumn(db, 'table_name', 'old_name', 'new_name');

// Drop a column (SQLite 3.35.0+)
await dropColumn(db, 'table_name', 'column_name');
```

### Data Operations

```typescript
// Copy data between columns
await copyColumn(db, 'table_name', 'source_col', 'dest_col');

// Transform data with SQL expression
await transformColumn(
  db,
  'table_name',
  'column_name',
  'UPPER(column_name)', // SQL expression
  'column_name IS NOT NULL' // Optional WHERE clause
);

// Batch updates for large datasets
await updateInBatches(
  db,
  'table_name',
  'UPDATE table_name SET processed = 1',
  'processed IS NULL',
  1000, // batch size
  (current, total) => console.log(`Progress: ${current}/${total}`)
);
```

### Metadata Operations

```typescript
// Update version on all tables (called automatically after each migration)
await updateMetadataVersion(db, '1.1');

// Check how many records need migration
const count = await getOutdatedRecordCount(db, 'asset_local', '1.0');
```

## Best Practices

### ✅ DO

- **Test with real data** before deploying
- **Keep migrations idempotent** - safe to run multiple times
- **Only migrate `*_local` tables** - synced tables are handled by server
- **Provide progress updates** for long-running operations
- **Use transactions** for atomic operations
- **Log all operations** for debugging
- **Document why** the migration is needed (link to PR/ticket)

### ❌ DON'T

- **Never delete user data** - transform in-place instead
- **Don't assume column order** - SQLite doesn't preserve it
- **Don't skip version testing** - test migration chains (1.0→1.1→1.2)
- **Don't migrate synced tables** - server handles those via RPC
- **Don't make breaking changes** without migration path
- **Don't deploy untested migrations** - always test on real data first

## Common Patterns

### Adding a Column

```typescript
async migrate(db) {
  // ONLY local table - server handles synced table
  await addColumn(db, 'asset_local', 'new_field TEXT DEFAULT "default"');
  // DO NOT add to 'asset' table - server RPC handles this
}
```

### Renaming a Column

```typescript
async migrate(db) {
  // SQLite limitation: Create new, copy, update schema
  await addColumn(db, 'asset_local', 'new_name TEXT');
  await copyColumn(db, 'asset_local', 'old_name', 'new_name');
  
  // Update Drizzle schema to use new_name
  // Drop old_name in future migration if needed
}
```

### Transforming Data

```typescript
async migrate(db) {
  // Transform with SQL expression
  await transformColumn(
    db,
    'asset_local',
    'status',
    "CASE WHEN status = 'old_value' THEN 'new_value' ELSE status END"
  );
}
```

### Adding a Required Field

```typescript
async migrate(db) {
  // Add as nullable first
  await addColumn(db, 'asset_local', 'required_field TEXT');
  
  // Fill in values
  await db.execute(sql`
    UPDATE asset_local
    SET required_field = 'default'
    WHERE required_field IS NULL
  `);
  
  // Update Drizzle schema to mark notNull()
}
```

## Troubleshooting

### Migration Fails During Development

1. Check logs for specific error
2. Verify SQL syntax (use raw SQLite if needed)
3. Check that tables/columns exist
4. Ensure Drizzle schema matches database state

### Users Stuck on Migration Screen

1. Check error logs from MigrationScreen
2. Verify migration is idempotent
3. Add more granular try/catch blocks
4. Consider splitting large migration into smaller steps

### Migration Runs But Data is Wrong

1. Test migration with real production-like data
2. Check WHERE clauses - might be missing records
3. Verify ONLY `*_local` tables were migrated (not synced tables)
4. Remember synced tables are handled by server RPC
5. Check for race conditions with PowerSync sync

### Schema Mismatch After Migration

1. Ensure APP_SCHEMA_VERSION was bumped
2. Verify migration updated _metadata on all `*_local` records only
3. Remember synced tables get schema updates from server
4. Check that createUnionViews() ran after migration
5. Restart app to ensure fresh schema load

## Version Numbering

We use semantic versioning for schema versions:

- **Major** (1.0 → 2.0): Breaking changes, major restructuring
- **Minor** (1.0 → 1.1): New features, additive changes
- **Patch** (1.0.0 → 1.0.1): Bug fixes, data corrections

Examples:
- Adding a column: `1.0` → `1.1` (minor)
- Renaming a table: `1.0` → `2.0` (major)
- Fixing data format: `1.0.0` → `1.0.1` (patch)

## Migration Execution Flow

```
App Startup
    ↓
System.init()
    ↓
PowerSync.init()
    ↓
checkNeedsMigration()
    ↓
┌───────────────────────┐
│ Needs Migration?      │
└───────────────────────┘
         ↓ Yes              ↓ No
┌─────────────────┐    Continue
│ Throw           │    Normal Init
│ MigrationNeeded │
│ Error           │
└─────────────────┘
         ↓
┌─────────────────┐
│ AuthContext     │
│ catches error   │
│ Sets migration  │
│ Needed flag     │
└─────────────────┘
         ↓
┌─────────────────┐
│ App.tsx shows   │
│ MigrationScreen │
└─────────────────┘
         ↓
┌─────────────────┐
│ runMigrations() │
│ • Find path     │
│ • Run in order  │
│ • Update meta   │
│ • Show progress │
└─────────────────┘
         ↓
┌─────────────────┐
│ Reload app      │
│ Continue normal │
└─────────────────┘
```

## Future Enhancements

Ideas for improving the migration system:

- [ ] Migration rollback support
- [ ] Dry-run mode for testing
- [ ] Migration statistics/analytics
- [ ] Automatic backups before migration
- [ ] Migration versioning per table (instead of global)
- [ ] Migration queue for gradual background processing
- [ ] Migration verification/checksum system

## References

- [SQLite ALTER TABLE docs](https://www.sqlite.org/lang_altertable.html)
- [Drizzle ORM docs](https://orm.drizzle.team/)
- [PowerSync docs](https://docs.powersync.com/)
- Example migration: `1.0-to-1.1.ts`


