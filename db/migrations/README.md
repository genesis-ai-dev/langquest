# Client-Side Schema Migrations

When `APP_SCHEMA_VERSION` changes, the app transforms on-device SQLite before it becomes interactive. A fullscreen `MigrationScreen` runs the hops and reports progress.

Offline drafts never hit the server until they are published. Those rows have to be migrated on the device.

## Current layout (2.6+)

Each entity is one PowerSync table (`quest`, `asset`, …). Raw storage is `ps_data__quest`. Unpublished drafts live in that same table with `quest.published_at` null.

Pre-2.6 databases used a triplicate: `*_local` / `*_synced` / a union view. That layout is gone. Collapsing it is a one-shot in `upgradeToSingleTable.ts`, not a normal version hop.

## Two mechanisms

### Version hops (`2.4-to-2.5.ts`, `2.5-to-2.6.ts`, …)

Registered in `index.ts`. `findMigrationPath()` requires a hop for **every** `APP_SCHEMA_VERSION` bump, even when `migrate()` is a no-op. Without one, users with existing rows land on the migration screen and fail with "No migration path found".

After each hop, the framework stamps `_metadata.schema_version` via `updateMetadataVersion()`.

`APP_SCHEMA_VERSION` lives in `db/constants.ts`. It must move together with `get_schema_info()` on the server. See `.cursor/rules/app-database-migration.mdc`.

### One-shot layout upgrade (`upgradeToSingleTable.ts`)

PowerSync's constructor calls `powersync_replace_schema` immediately. That drops leftover 2.5 `*_local` tables that are not in the current schema.

So the one-shot runs on a raw SQLite handle **before** PowerSync is constructed:

1. Copy `ps_data__{table}_synced` → `ps_data__{table}` (offline cache of already-downloaded rows).
2. Write unpublished `*_local` rows to `ps_upgrade_2_6_drafts.json` (survives `replace_schema`).
3. Stamp `published_at` only on quests that came from `*_synced`. Do not stamp live 2.6 drafts.
4. Drop leftover `_local` / `_synced` tables and union views.

After `powersync.init()`, `reinsertUnpublishedDrafts()` inserts those JSON rows through Drizzle so they enter `ps_crud` and upload. The insert always sets `id` from the raw PowerSync PK (`data` does not contain it). Without that, Drizzle mints a new UUID and children keep the old `parent_id`.

`2.5-to-2.6.ts` is a no-op version hop so `findMigrationPath()` can step 2.5 → 2.6. The layout work is not in that file.

System calls three functions from `upgradeToSingleTable.ts`:

- `prepareSingleTableLayout(rawDb)` — before constructing PowerSync
- `schemaVersionForMigration(rawDb, minVersion)` — leftover 2.5 layout with no versioned rows is 2.5, not 0.0
- `reinsertUnpublishedDrafts({ getAll, insert })` — after `powersync.init()`

## What gets scanned for version

`getMinimumSchemaVersion()`:

- Leftover `*_local` tables (until the one-shot drops them): unversioned → `0.0`
- Unsuffixed `ps_data__*`: unversioned rows are PowerSync downloads and are **ignored**. Only client-stamped rows count. That is how 2.6 → 2.7 is detected.

Leftover triplicate objects are a layout signal (`needsSingleTableUpgrade()`), not a version signal.

## Creating a version hop

### 1. Change the Drizzle schema

Edit `db/drizzleSchemaColumns.ts`. PowerSync stores JSON; adding a nullable column the app reads as `undefined` usually needs **no** data transform. Register a no-op hop anyway if you bump the version.

### 2. Bump `APP_SCHEMA_VERSION` and `get_schema_info()`

Same release. Format: `MAJOR.MINOR`.

- Minor (`2.6` → `2.7`): additive
- Major (`2.6` → `3.0`): destructive

### 3. Add `db/migrations/X.X-to-Y.Y.ts`

No-op (see `2.4-to-2.5.ts`) when PowerSync JSON already projects the new field as null.

Data transform when existing rows need a backfill or a rename. Operate on raw tables through `utils.ts` (`getRawTableName('asset')` → `ps_data__asset`). Do not use `addColumn()` for columns already in the Drizzle schema — PowerSync already created them.

Hops that still run on a pre-2.6 database may see leftover `asset_local` names. `getRawTableName('asset_local')` maps those.

### 4. Register it

```typescript
import { migration_2_6_to_2_7 } from './2.6-to-2.7';

export const migrations: Migration[] = [
  // …
  migration_2_5_to_2_6,
  migration_2_6_to_2_7
];
```

### 5. Test

Test with real on-device data. Test the chain (`2.4` → `2.5` → `2.6`) and a direct hop. Confirm `_metadata.schema_version` after the run.

## Helpers (`utils.ts`)

```typescript
await addColumn(db, 'asset', 'dynamic_col TEXT DEFAULT NULL');
await renameColumn(db, 'asset', 'old_name', 'new_name');
await dropColumn(db, 'asset', 'column_name');
await copyColumn(db, 'asset', 'source_col', 'dest_col');
await transformColumn(db, 'asset', 'status', "CASE WHEN status = 'old' THEN 'new' ELSE status END");
await updateMetadataVersion(db, '2.7'); // also called automatically after each hop
```

`updateMetadataVersion` stamps leftover `*_local` raw tables (if still on disk) and unsuffixed `ps_data__*` tables.

## Rules

Do:

- Keep hops idempotent
- Report progress for long work
- Transform in place; do not delete user rows
- Register a hop for every version bump

Do not:

- Skip a registered hop when bumping `APP_SCHEMA_VERSION`
- Treat PowerSync downloads as unversioned `0.0` (they are ignored on unsuffixed tables)
- Stamp `published_at` on every `ps_data__quest` row during 2.5 → 2.6 (that would publish live drafts)
- Call `addColumn()` for a column already in `drizzleSchemaColumns.ts`

## Startup flow

```
App start
  → PreAuthMigrationCheck (raw SQLite, PowerSync not constructed yet)
  → checkNeedsAnyUpgrade()  (version hop and/or leftover 2.5 layout)
        ↓ needed                    ↓ not needed
  MigrationScreen              prepareSingleTableLayout() (no-op)
  runMigrations() (version hops)
  prepareSingleTableLayout()
  ensurePowerSyncCreated()
        ↓
  Auth / system.init()
  powersync.init()
  reinsertUnpublishedDrafts()
  continue
```

## Troubleshooting

**Stuck on MigrationScreen** — missing hop in `index.ts`, or a hop that throws. Check logs. Hops must be idempotent.

**Drafts missing after 2.6** — PowerSync was constructed before `prepareSingleTableLayout()`. Unpublished `*_local` rows are gone. The JSON file is the only durable staging.

**"Empty database" with rows present** — unsuffixed unversioned rows are downloads. That is expected. Leftover layout is detected separately.

**Schema mismatch after a hop** — confirm `APP_SCHEMA_VERSION` and `get_schema_info()` match, and that `_metadata` was stamped on unsuffixed tables.

## Version numbering

- **Major** (`2.6` → `3.0`): destructive client change
- **Minor** (`2.6` → `2.7`): additive client change

Patch versions are not used for `APP_SCHEMA_VERSION`.

## References

- Schema version: `db/constants.ts`
- Hop registry: `db/migrations/index.ts`
- Layout upgrade: `db/migrations/upgradeToSingleTable.ts`
- No-op hop: `db/migrations/2.4-to-2.5.ts`
- Cursor rule: `.cursor/rules/app-database-migration.mdc`
- [PowerSync schema changes](https://docs.powersync.com/usage/lifecycle-maintenance/implementing-schema-changes)
- [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html)
