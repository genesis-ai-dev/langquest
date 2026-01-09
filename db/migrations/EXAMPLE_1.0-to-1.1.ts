/**
 * Example Migration: 1.0 → 1.1
 *
 * This is a template migration to demonstrate the structure.
 * Copy this file when creating new migrations.
 *
 * IMPORTANT: This migration is NOT registered in the migrations array.
 * It serves only as a template and documentation.
 *
 * When creating a real migration:
 * 1. Copy this file to a new name (e.g., 1.1-to-1.2.ts)
 * 2. Update fromVersion and toVersion
 * 3. Implement the migrate() function
 * 4. Register the migration in db/migrations/index.ts
 * 5. Bump APP_SCHEMA_VERSION in db/drizzleSchema.ts
 *
 * CRITICAL: JSON-First Migration Approach
 * =======================================
 * PowerSync stores data as JSON in raw tables (ps_data_local__*.data column).
 * Migrations should use JSON-first approach:
 * - Read legacy fields using json_extract(data, '$.field_name')
 * - Update data using json_set(data, '$.field_name', value)
 * - Check for table/key existence before processing
 * - Use getRawTableName() to get raw PowerSync table names
 * - Use rawTableExists() and rawJsonKeyExists() for preflight checks
 *
 * ⚠️  WARNING: DO NOT USE addColumn() FOR SCHEMA-DEFINED COLUMNS!
 * ================================================================
 * PowerSync creates local-only tables with ALL columns from the Drizzle schema.
 * If a column is already defined in drizzleSchemaColumns.ts, it will already
 * exist in the raw PowerSync table. Using addColumn() will corrupt the table.
 * Only use addColumn() for truly DYNAMIC columns that are NOT in the schema.
 *
 * IMPORTANT: Only migrate *_local tables!
 * Synced tables are migrated server-side via RPC (ps_transform_v1_to_v2).
 * When local data is uploaded, the server transforms it automatically.
 */

import type { Migration } from './index';
import {
  getRawTableName,
  rawTableExists,
  rawJsonKeyExists,
  addColumn
} from './utils';

throw new Error('This is an example migration file - do not use it!');

export const migration_1_0_to_1_1: Migration = {
  fromVersion: '1.0',
  toVersion: '1.1',
  description: 'EXAMPLE: Add notes field to assets (template only)',

  async migrate(db, onProgress) {
    console.log('[Migration 1.0→1.1] Starting example migration...');

    // Preflight: Verify raw table exists before processing
    const assetLocalRawExists = await rawTableExists(db, 'asset_local');

    if (!assetLocalRawExists) {
      console.log(
        '[Migration 1.0→1.1] No raw asset_local table found, skipping migration'
      );
      return;
    }

    // Step 1: Add a notes column to asset_local (only if NOT in schema)
    // ==================================================================
    // NOTE: This example assumes 'notes' is NOT in drizzleSchemaColumns.ts
    // If it IS in the schema, skip this step - PowerSync already created it!
    if (onProgress) onProgress(1, 2, 'Adding notes column to asset_local');

    console.log('[Migration 1.0→1.1] Adding notes column...');
    // Only use addColumn() for columns NOT defined in Drizzle schema
    // Helper will convert 'asset_local' view name -> 'ps_data_local__asset_local' table
    await addColumn(db, 'asset_local', 'notes TEXT DEFAULT NULL');
    console.log('[Migration 1.0→1.1] ✓ Notes column added');

    // Step 2: Initialize notes for existing records using JSON-first approach
    // ========================================================================
    if (onProgress) onProgress(2, 2, 'Initializing notes for existing assets');

    console.log('[Migration 1.0→1.1] Setting default notes using JSON-first approach...');
    
    // CRITICAL: Update raw PowerSync table directly using json_set()
    // PowerSync stores data as JSON in 'data' column, not individual columns
    const assetLocalTable = getRawTableName('asset_local');
    await db.execute(`
      UPDATE ${assetLocalTable}
      SET data = json_set(
        data,
        '$.notes',
        'Migration test: Added in schema v1.1'
      )
      WHERE json_extract(data, '$.notes') IS NULL 
        AND json_extract(data, '$.active') = 1
    `);
    console.log('[Migration 1.0→1.1] ✓ Default notes set');

    console.log('[Migration 1.0→1.1] ✓ Example migration complete');

    // Note: updateMetadataVersion() is called automatically by the migration system
    // You don't need to call it here (and it only updates *_local tables)
  }
};

// ============================================================================
// MIGRATION BEST PRACTICES
// ============================================================================

/**
 * 1. ALWAYS test migrations on a copy of real data before deploying
 *    - Use testing/client-migrations/{version}.db files
 *    - Follow the analyze-migration-steps workflow
 *    - Verify migrations work from any version to target version
 *
 * 2. Use JSON-FIRST approach for reading legacy fields
 *    - Read from raw PowerSync JSON storage: json_extract(data, '$.field_name')
 *    - Check if keys exist: rawJsonKeyExists() before processing
 *    - This allows migrations to work even after fields are removed from views
 *
 * 3. Keep migrations IDEMPOTENT - safe to run multiple times
 *    - Check if tables exist: rawTableExists() before processing
 *    - Check if keys exist: rawJsonKeyExists() before reading
 *    - Use WHERE clauses to avoid re-processing data
 *    - Skip gracefully if no data to migrate
 *
 * 4. Only migrate *_local tables
 *    - Synced tables are migrated server-side via RPC
 *    - When local data is uploaded, server transforms it automatically
 *    - Never modify synced tables in client migrations
 *
 * 5. ⚠️  DO NOT use addColumn() for schema-defined columns
 *    - PowerSync auto-creates tables with ALL columns from Drizzle schema
 *    - Using addColumn() on existing columns corrupts table structure
 *    - Only use addColumn() for truly DYNAMIC columns NOT in schema
 *    - Most migrations only need DATA operations, not schema changes
 *
 * 6. Update JSON data directly using json_set()
 *    - PowerSync stores data as JSON in 'data' column
 *    - Use json_set(data, '$.field', value) to update fields
 *    - Use json_extract(data, '$.field') to read fields
 *    - Always use getRawTableName() to get correct table name
 *
 * 7. Be BACKWARDS COMPATIBLE when possible
 *    - Add columns with DEFAULT values
 *    - Don't drop columns immediately (deprecate first)
 *    - Use transforms to fill in missing data
 *
 * 8. NEVER delete user data
 *    - Transform in-place
 *    - Keep backups (similar to publishService philosophy)
 *    - Log all operations for debugging
 *
 * 9. Provide PROGRESS UPDATES for long-running migrations
 *    - Call onProgress() regularly
 *    - Break work into logical steps
 *    - Show meaningful step descriptions
 *
 * 10. Handle ERRORS gracefully
 *     - Wrap risky operations in try/catch
 *     - Throw errors for critical failures
 *     - Log warnings for non-critical issues
 *     - Skip gracefully if tables/keys don't exist
 *
 * 11. Consider PERFORMANCE
 *     - Use batch updates for large datasets (updateInBatches)
 *     - Add indexes if needed for migration queries
 *     - Avoid complex operations on every record
 *
 * 12. Document WHY the migration exists
 *     - Link to relevant tickets/PRs
 *     - Explain schema changes
 *     - Note any breaking changes
 *     - Document which legacy fields are read/transformed
 *
 * 13. Test MIGRATION CHAINS
 *     - Test 1.0→1.1, 1.1→1.2, and 1.0→1.2
 *     - Ensure users can skip versions safely
 *     - Verify _metadata gets updated correctly
 *     - Test with test data that covers all migration scenarios
 */

// ============================================================================
// COMMON MIGRATION PATTERNS
// ============================================================================

/**
 * Pattern: Preflight checks (always do this first!)
 * =================================================
 *
 * async migrate(db) {
 *   // Check if raw table exists
 *   const tableExists = await rawTableExists(db, 'table_local');
 *   if (!tableExists) {
 *     console.log('No table found, skipping migration');
 *     return;
 *   }
 *
 *   // Check if legacy field exists in JSON
 *   const hasLegacyField = await rawJsonKeyExists(
 *     db,
 *     'table_local',
 *     '$.legacy_field',
 *     'local'
 *   );
 *   if (!hasLegacyField) {
 *     console.log('No legacy field found, skipping migration');
 *     return;
 *   }
 * }
 */

/**
 * Pattern: Read legacy field from JSON and transform
 * ==================================================
 *
 * async migrate(db) {
 *   const tableName = getRawTableName('table_local');
 *
 *   // Read legacy field from JSON and populate new field
 *   await db.execute(`
 *     UPDATE ${tableName}
 *     SET data = json_set(
 *       data,
 *       '$.new_field',
 *       json_extract(data, '$.legacy_field')
 *     )
 *     WHERE json_extract(data, '$.new_field') IS NULL
 *       AND json_extract(data, '$.legacy_field') IS NOT NULL
 *   `);
 * }
 */

/**
 * Pattern: Backfill a new field with default value
 * =================================================
 *
 * async migrate(db) {
 *   const tableName = getRawTableName('table_local');
 *
 *   // Set default value for all records missing the field
 *   await db.execute(`
 *     UPDATE ${tableName}
 *     SET data = json_set(
 *       data,
 *       '$.new_field',
 *       'default_value'
 *     )
 *     WHERE json_extract(data, '$.new_field') IS NULL
 *   `);
 * }
 */

/**
 * Pattern: Transform data using JSON functions
 * ============================================
 *
 * async migrate(db) {
 *   const tableName = getRawTableName('table_local');
 *
 *   // Transform existing field value
 *   await db.execute(`
 *     UPDATE ${tableName}
 *     SET data = json_set(
 *       data,
 *       '$.field',
 *       UPPER(json_extract(data, '$.field'))
 *     )
 *     WHERE json_extract(data, '$.field') IS NOT NULL
 *   `);
 * }
 */

/**
 * Pattern: Create new records from legacy data
 * =============================================
 *
 * async migrate(db) {
 *   const sourceTable = getRawTableName('source_local');
 *   const targetTable = getRawTableName('target_local');
 *
 *   // Read legacy data and create new records
 *   const records = await db.getAll(`
 *     SELECT data FROM ${sourceTable}
 *     WHERE json_extract(data, '$.legacy_field') IS NOT NULL
 *   `);
 *
 *   for (const record of records) {
 *     const data = JSON.parse(record.data as string);
 *     const newRecord = {
 *       id: generateId(),
 *       new_field: data.legacy_field,
 *       _metadata: { schema_version: '1.1' }
 *     };
 *
 *     await db.execute(`
 *       INSERT INTO ${targetTable} (id, data)
 *       VALUES (?, json(?))
 *     `, [newRecord.id, JSON.stringify(newRecord)]);
 *   }
 * }
 */

/**
 * Pattern: Add column (ONLY if NOT in Drizzle schema!)
 * =====================================================
 *
 * ⚠️  WARNING: Only use this if the column is NOT defined in drizzleSchemaColumns.ts!
 *
 * async migrate(db) {
 *   // 1. Add new column to raw PowerSync table
 *   await addColumn(db, 'table_local', 'new_column TEXT DEFAULT NULL');
 *
 *   // 2. Populate data using JSON-first approach
 *   const tableName = getRawTableName('table_local');
 *   await db.execute(`
 *     UPDATE ${tableName}
 *     SET data = json_set(
 *       data,
 *       '$.new_column',
 *       'default_value'
 *     )
 *     WHERE json_extract(data, '$.new_column') IS NULL
 *   `);
 *
 *   // 3. Update Drizzle schema to include new_column
 *   // 4. In next version, you can use the column normally
 * }
 */
