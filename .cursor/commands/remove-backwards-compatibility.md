Remove backwards compatibility code for @version:

Find TypeScript code referencing versions below @version. Remove it from application files only. Verify min_required_schema_version in get_schema_info() makes this code obsolete.

## PowerSync is Schemaless (Important!)

PowerSync stores synced data as **schemaless JSON** internally. The client-side Drizzle schema is just a "view" on top of this data. This has important implications:

> "The schema as supplied on the client is only a view on top of the schemaless data. Updating this client-side schema is immediate when the new version of the app runs, **with no client-side migrations required**."
>
> — [PowerSync: Implementing Schema Changes](https://docs.powersync.com/usage/lifecycle-maintenance/implementing-schema-changes)

**Important clarification:** PowerSync handles _schema changes_ (adding/removing columns) automatically without migrations. However, **data transformations** (modifying existing data, backfilling values, computing derived fields) still require client-side migrations.

## Step 1: Examine all migration files

CRITICAL FIRST STEP: Read and understand ALL migration files from version 0.0 up to @version:

1. Read the target migration file `db/migrations/{previousVersion}-to-{@version}.ts` (e.g., `db/migrations/1.0-to-2.0.ts`)
2. Read ALL previous migration files (e.g., `db/migrations/0.0-to-1.0.ts`, etc.)
3. Check SQL migration files in `supabase/migrations/` for fields/tables that were removed in earlier migrations that are no longer relevant from @version and beyond.
4. Check when `get_schema_info()` function is updated in SQL migrations to identify what fields/tables were removed

The migration files show what data transformations happen when upgrading from older versions. Identify:
- What old data patterns/structures each migration handles
- What fields/relationships each migration creates or populates
- What fields/tables were removed in earlier migrations (may not be in the current migration file)
- What fallback logic the migrations implement

Example: If removing backwards compatibility for version 2.0:
- Check `db/migrations/1.0-to-2.0.ts` for what it handles
- Check `db/migrations/0.0-to-1.0.ts` for earlier changes
- Check SQL migrations for fields like `project.source_language_id` that may have been removed in earlier migrations
- Look for code handling these earlier removals that is now obsolete

## Step 2: Identify obsolete application code

Search for TypeScript/React code in application files that handles the OLD patterns that ANY migration (current or previous) covers:

- Code that checks for missing fields/relationships that migrations now populate
- Code that creates records on-the-fly that migrations now create
- Code that handles NULL/missing values that migrations now fill
- Code that has version checks (`< @version` or `<= @version`) handling these old patterns
- Fallback logic for old data structures that migrations transform
- All code accessing old fields that migrations replace (e.g., `project.target_language_id` → use `project_language_link` instead)
- Code accessing fields removed in EARLIER migrations (e.g., `project.source_language_id` may have been removed in a SQL migration before the current migration)
- Old fields in TypeScript types/interfaces (including fields removed in earlier migrations)
- `if/else` branches that check for old vs new data structures
- **Check Supabase Edge Functions**: Review code in `supabase/functions/` for any backwards compatibility logic, old field references, or version checks that need to be updated or removed

### Schema Definition Alignment

**CRITICAL**: Verify that TypeScript schema definitions match what migrations actually do:

1. **Check SQL migrations for `DROP COLUMN` statements**: When a SQL migration drops a column (e.g., `ALTER TABLE project DROP COLUMN source_language_id`), that column MUST be removed from the corresponding table definition in `db/drizzleSchemaColumns.ts`.

2. **Check TypeScript migration files**: When a TypeScript migration removes or transforms fields, verify those fields are also removed from schema definitions.

3. **Verify schema consistency**: After identifying all dropped columns in migrations:
   - Search `db/drizzleSchemaColumns.ts` for any fields that were dropped in migrations
   - Remove dropped columns from table definitions (e.g., `createProjectTable`, `createAssetTable`, etc.)
   - Remove dropped columns from index definitions
   - Remove dropped columns from relation definitions in `db/drizzleSchema.ts`

4. **Exception for nullable columns**: If a migration only makes a column nullable (doesn't drop it), the column should remain in the schema definition but be marked as nullable. Only remove columns that are completely dropped.

Example: If a SQL migration contains `ALTER TABLE project DROP COLUMN IF EXISTS source_language_id`, then `source_language_id` must be removed from `createProjectTable()` in `drizzleSchemaColumns.ts`, even if it was dropped in an earlier migration than the one you're currently removing compatibility for.

Important: A field may have been removed in an earlier migration (e.g., SQL migration) but code may still reference it. Check all previous migrations, not just the current one.

Remember: Migrate code to use new patterns, then remove old field references entirely. Don't deprecate—remove.

## Step 3: Migrate code, don't deprecate

CRITICAL: Do NOT deprecate old code. Instead:

1. Update code to use the new data structures/fields that the migration creates. Replace old field access with new field access.

2. Remove TypeScript/React code that references old fields that are no longer used after the migration. Remove old field references from types, queries, components, and services. Even if a database column still exists (e.g., nullable columns kept for schema compatibility), remove unused fields from TypeScript interfaces and types. If the field must remain due to database schema constraints (e.g., `.select()` returns all columns), document why it's kept and that it's unused. Consider using explicit column selection or type utilities (`Omit`, `Pick`) to exclude unused fields from application code types.

3. Simplify logic: Remove fallback code and conditional branches that handle old patterns. The migration ensures all data follows the new pattern, so this code is obsolete.

Example: If `project.target_language_id` is replaced by `project_language_link.language_id`:
- ❌ Don't: Add `@deprecated` tags and keep both code paths
- ✅ Do: Replace all `project.target_language_id` references with `project_language_link.language_id` queries, then remove `target_language_id` from types and all code

## What NOT to modify

Do not modify migration system files:
- `db/migrations/index.ts`
- `db/migrations/utils.ts`
- `schemaVersionService.ts`
- Any migration files `db/migrations/*.ts`

These files are immutable. They handle the migration chain and must remain unchanged.

## Server-side

- Keep full transform chain in mutation handlers (`apply_table_mutation`, `apply_table_mutation_transaction`). Never drop transform functions or helpers—they're permanent migration history.
- Verify transform functions don't query tables that will be dropped
- Don't update `get_schema_info()` unless the version you're removing is newer than the current `min_required_schema_version`
- min_required_schema_version blocks old app versions from syncing, but old PowerSync data must still be transformed when it syncs up

## Critical warnings
- Table dependencies: Transform functions querying tables fail when those tables are dropped. Use permanent lookup tables or handle missing tables gracefully.
- Table renames: Update transform functions to map old table names to new ones. Transform functions reference tables by name in `mutation_op.table_name`. This works for most cases. Be careful with table splits, merges, or complex data restructuring.

## Final step: Type check

**CRITICAL**: After removing backwards compatibility code, run a TypeScript type check to ensure all type errors are resolved:

```bash
npm run typecheck
```

This verifies that:
- All removed fields are no longer referenced in types
- Schema definitions match the actual database structure
- All code paths use the new data structures correctly
- No type errors were introduced during the refactoring
