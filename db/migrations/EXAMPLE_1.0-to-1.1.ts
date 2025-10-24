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
 * CRITICAL: Understanding Database Access
 * ========================================
 * - addColumn/renameColumn/dropColumn: Access raw PowerSync tables (ps_data_local__*)
 * - transformColumn/copyColumn/UPDATE queries: Work through views
 * - The helper functions handle this automatically, just pass view names
 */

import { sql } from 'drizzle-orm';
import type { Migration } from './index';
import {
    addColumn
} from './utils';

throw new Error('This is an example migration file - do not use it!');

export const migration_1_0_to_1_1: Migration = {
    fromVersion: '1.0',
    toVersion: '1.1',
    description: 'TEST MIGRATION: Add notes field to assets (will be reverted)',

    async migrate(db, onProgress) {
        console.log('[Migration 1.0→1.1] Starting TEST migration...');
        console.log('[Migration 1.0→1.1] This is a TEST - will be reverted after validation');

        // IMPORTANT: Only migrate *_local tables!
        // Synced tables are migrated server-side via RPC (ps_transform_v1_to_v2)
        // When local data is uploaded, the server transforms it automatically

        // Step 1: Add a notes column to asset_local
        // ================================================
        if (onProgress) onProgress(1, 2, 'Adding notes column to asset_local');

        console.log('[Migration 1.0→1.1] Adding notes column...');
        // Helper will convert 'asset_local' view name -> 'ps_data_local__asset_local' table
        await addColumn(db, 'asset_local', 'notes TEXT DEFAULT NULL');
        console.log('[Migration 1.0→1.1] ✓ Notes column added');

        // Step 2: Initialize notes for existing records (optional data transformation test)
        // ==================================================================================
        if (onProgress) onProgress(2, 2, 'Initializing notes for existing assets');

        console.log('[Migration 1.0→1.1] Setting default notes...');
        // Query through the view - it exposes all columns including new 'notes'
        await db.run(sql.raw(`
            UPDATE asset_local
            SET notes = 'Migration test: Added in schema v1.1'
            WHERE notes IS NULL AND active = 1
        `));
        console.log('[Migration 1.0→1.1] ✓ Default notes set');

        console.log('[Migration 1.0→1.1] ✓ TEST Migration complete');
        console.log('[Migration 1.0→1.1] Remember to revert this migration after testing!');

        // Note: updateMetadataVersion() is called automatically by the migration system
        // You don't need to call it here (and it only updates *_local tables)
    }
};

// ============================================================================
// MIGRATION BEST PRACTICES
// ============================================================================

/**
 * 1. ALWAYS test migrations on a copy of real data before deploying
 *
 * 2. Keep migrations IDEMPOTENT - safe to run multiple times
 *    - Check if columns exist before adding
 *    - Use IF NOT EXISTS where possible
 *    - Use WHERE clauses to avoid re-processing data
 *
 * 3. Handle BOTH *_local and synced tables
 *    - Users might have data in either/both
 *    - Drizzle schema applies to both table types
 *
 * 4. Be BACKWARDS COMPATIBLE when possible
 *    - Add columns with DEFAULT values
 *    - Don't drop columns immediately (deprecate first)
 *    - Use transforms to fill in missing data
 *
 * 5. NEVER delete user data
 *    - Transform in-place
 *    - Keep backups (similar to publishService philosophy)
 *    - Log all operations for debugging
 *
 * 6. Provide PROGRESS UPDATES for long-running migrations
 *    - Call onProgress() regularly
 *    - Break work into logical steps
 *    - Show meaningful step descriptions
 *
 * 7. Handle ERRORS gracefully
 *    - Wrap risky operations in try/catch
 *    - Throw errors for critical failures
 *    - Log warnings for non-critical issues
 *
 * 8. Consider PERFORMANCE
 *    - Use batch updates for large datasets (updateInBatches)
 *    - Add indexes if needed for migration queries
 *    - Avoid complex operations on every record
 *
 * 9. Document WHY the migration exists
 *    - Link to relevant tickets/PRs
 *    - Explain schema changes
 *    - Note any breaking changes
 *
 * 10. Test MIGRATION CHAINS
 *     - Test 1.0→1.1, 1.1→1.2, and 1.0→1.2
 *     - Ensure users can skip versions safely
 *     - Verify _metadata gets updated correctly
 */

// ============================================================================
// COMMON MIGRATION PATTERNS
// ============================================================================

/**
 * Pattern: Rename a column (SQLite way)
 * =====================================
 *
 * SQLite has limited ALTER TABLE support. For complex renames:
 *
 * async migrate(db) {
 *   // 1. Add new column
 *   await addColumn(db, 'table_name', 'new_column TEXT');
 *
 *   // 2. Copy data
 *   await copyColumn(db, 'table_name', 'old_column', 'new_column');
 *
 *   // 3. Update Drizzle schema to reference new_column
 *   // 4. In next version, drop old_column (if SQLite supports it)
 * }
 */

/**
 * Pattern: Change column type
 * ============================
 *
 * async migrate(db) {
 *   // 1. Add new column with new type
 *   await addColumn(db, 'table_name', 'field_new INTEGER');
 *
 *   // 2. Transform and copy data
 *   await transformColumn(
 *     db,
 *     'table_name',
 *     'field_new',
 *     'CAST(field_old AS INTEGER)'
 *   );
 *
 *   // 3. Update Drizzle schema to use field_new
 *   // 4. Eventually drop field_old
 * }
 */

/**
 * Pattern: Add NOT NULL column
 * =============================
 *
 * async migrate(db) {
 *   // 1. Add column as nullable first
 *   await addColumn(db, 'table_name', 'new_field TEXT DEFAULT NULL');
 *
 *   // 2. Fill in values for all existing records
 *   await db.execute(sql`
 *     UPDATE table_name
 *     SET new_field = 'default_value'
 *     WHERE new_field IS NULL
 *   `);
 *
 *   // 3. In Drizzle schema, mark as notNull() with default
 *   // SQLite won't enforce NOT NULL retroactively, but new inserts will
 * }
 */

/**
 * Pattern: Create a new relationship
 * ===================================
 *
 * async migrate(db) {
 *   // 1. Add foreign key column
 *   await addColumn(db, 'child_table', 'parent_id TEXT');
 *
 *   // 2. Populate relationships based on existing data
 *   await db.execute(sql`
 *     UPDATE child_table
 *     SET parent_id = (
 *       SELECT p.id FROM parent_table p
 *       WHERE p.some_field = child_table.matching_field
 *       LIMIT 1
 *     )
 *   `);
 *
 *   // 3. Update Drizzle schema with relation definitions
 * }
 */


