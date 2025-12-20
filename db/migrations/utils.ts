/**
 * Migration Utility Functions
 *
 * Helper functions for common migration tasks like:
 * - Adding columns (schema changes)
 * - Renaming columns (schema changes)
 * - Updating _metadata version on all records (data changes)
 * - Data transformations (data changes)
 *
 * CRITICAL ARCHITECTURE NOTE:
 * ============================
 *
 * There are TWO types of migrations with different database access patterns:
 *
 * 1. **SCHEMA MIGRATIONS** (ALTER TABLE operations):
 *    - Add/rename/drop columns
 *    - Modify table structure
 *    - CANNOT work on views (views are virtual tables)
 *    - MUST access raw PowerSync tables: `ps_data_local__table_name`
 *    - Use: `rawPowerSync.execute()` on underlying tables
 *
 * 2. **DATA MIGRATIONS** (UPDATE/INSERT operations):
 *    - Update existing data
 *    - Transform values
 *    - Update _metadata
 *    - CAN work through views (SQLite redirects to underlying tables)
 *    - Use: `db.run()` through Drizzle views
 *
 * The functions in this file handle both cases automatically:
 * - Schema functions (addColumn, renameColumn, dropColumn) access raw PowerSync
 * - Data functions (transformColumn, copyColumn, updateMetadataVersion) use views
 *
 * ⚠️  WARNING: DO NOT USE addColumn() FOR SCHEMA-DEFINED COLUMNS!
 * ================================================================
 * PowerSync creates local-only tables with ALL columns from the Drizzle schema.
 * If a column is already defined in drizzleSchemaColumns.ts, it will already
 * exist in the raw PowerSync table. Using addColumn() will corrupt the table
 * by adding a duplicate column with a different structure.
 *
 * Only use addColumn() for truly DYNAMIC columns that are NOT in the schema.
 * For most migrations, you only need DATA operations (UPDATE/INSERT via views).
 */

import { sql } from 'drizzle-orm';
import type { DrizzleDB } from './index';

// Re-export for convenience in migration files
export type { DrizzleDB };

// ============================================================================
// SCHEMA MANIPULATION
// ============================================================================

/**
 * Add a new column to a table
 * SQLite only supports limited ALTER TABLE operations
 *
 * CRITICAL: This modifies the underlying PowerSync table, not the view!
 * Views cannot be altered. We need to access the raw PowerSync table.
 *
 * ⚠️  WARNING: Do NOT use this for columns defined in drizzleSchemaColumns.ts!
 * PowerSync auto-creates tables with schema-defined columns. Using addColumn()
 * for existing columns will corrupt the table structure.
 *
 * @param db - Drizzle database instance (contains .powersync for raw access)
 * @param table - View name (e.g., 'asset_local') - will be converted to PowerSync table name
 * @param columnDef - Full column definition (e.g., 'new_field TEXT DEFAULT NULL')
 */
export async function addColumn(
  db: DrizzleDB,
  table: string,
  columnDef: string
): Promise<void> {
  console.log(`[Migration] Adding column to ${table}: ${columnDef}`);

  // Convert view name to PowerSync table name
  // 'asset_local' -> 'ps_data_local__asset_local'
  const psTableName = `ps_data_local__${table}`;

  try {
    // Use raw PowerSync to alter the underlying table
    // Access via db.rawPowerSync (exposed by system.ts proxy)
    const rawPowerSync = db?.rawPowerSync;
    if (!rawPowerSync?.execute) {
      throw new Error(
        'Cannot access raw PowerSync instance for schema modification'
      );
    }

    await rawPowerSync.execute(
      `ALTER TABLE ${psTableName} ADD COLUMN ${columnDef}`
    );
    console.log(`[Migration] ✓ Column added to ${psTableName}`);
  } catch (error) {
    // Column might already exist - check if that's the case
    if (String(error).includes('duplicate column name')) {
      console.log(
        `[Migration] Column already exists in ${psTableName}, skipping`
      );
      return;
    }
    throw error;
  }
}

/**
 * Rename a column in a table
 * Note: SQLite has limited rename support. For complex cases, may need to:
 * 1. Create new column
 * 2. Copy data
 * 3. Drop old column (if possible)
 *
 * CRITICAL: This modifies the underlying PowerSync table, not the view!
 *
 * @param db - Drizzle database instance (contains .powersync for raw access)
 * @param table - View name (e.g., 'asset_local') - will be converted to PowerSync table name
 * @param oldName - Current column name
 * @param newName - New column name
 */
export async function renameColumn(
  db: DrizzleDB,
  table: string,
  oldName: string,
  newName: string
): Promise<void> {
  console.log(
    `[Migration] Renaming column in ${table}: ${oldName} → ${newName}`
  );

  // Convert view name to PowerSync table name
  const psTableName = `ps_data_local__${table}`;

  try {
    // Use raw PowerSync to alter the underlying table
    const rawPowerSync = db?.rawPowerSync;
    if (!rawPowerSync?.execute) {
      throw new Error(
        'Cannot access raw PowerSync instance for schema modification'
      );
    }

    // Try direct rename (SQLite 3.25.0+)
    await rawPowerSync.execute(
      `ALTER TABLE ${psTableName} RENAME COLUMN ${oldName} TO ${newName}`
    );
    console.log(`[Migration] ✓ Column renamed in ${psTableName}`);
  } catch (error) {
    console.error(`[Migration] Failed to rename column:`, error);
    throw new Error(
      `Could not rename column ${oldName} to ${newName} in ${psTableName}. ` +
        `You may need to manually create a new column and copy data.`
    );
  }
}

/**
 * Drop a column from a table
 * Note: SQLite only supports DROP COLUMN in 3.35.0+
 * For older SQLite versions, this will fail
 *
 * CRITICAL: This modifies the underlying PowerSync table, not the view!
 *
 * @param db - Drizzle database instance (contains .powersync for raw access)
 * @param table - View name (e.g., 'asset_local') - will be converted to PowerSync table name
 * @param columnName - Column to drop
 */
export async function dropColumn(
  db: DrizzleDB,
  table: string,
  columnName: string
): Promise<void> {
  console.log(`[Migration] Dropping column from ${table}: ${columnName}`);

  // Convert view name to PowerSync table name
  const psTableName = `ps_data_local__${table}`;

  try {
    // Use raw PowerSync to alter the underlying table
    const rawPowerSync = db?.rawPowerSync;
    if (!rawPowerSync?.execute) {
      throw new Error(
        'Cannot access raw PowerSync instance for schema modification'
      );
    }

    await rawPowerSync.execute(
      `ALTER TABLE ${psTableName} DROP COLUMN ${columnName}`
    );
    console.log(`[Migration] ✓ Column dropped from ${psTableName}`);
  } catch (error) {
    console.error(`[Migration] Failed to drop column:`, error);
    throw new Error(
      `Could not drop column ${columnName} from ${psTableName}. ` +
        `Your SQLite version may not support DROP COLUMN. ` +
        `Consider leaving the column and ignoring it in the schema.`
    );
  }
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform data in a column using a custom function
 * Useful for data migrations that don't change schema structure
 *
 * @param db - Drizzle database instance
 * @param table - Table name
 * @param column - Column to transform
 * @param transform - SQL expression for transformation (e.g., "UPPER(name)")
 * @param whereClause - Optional WHERE clause to limit updates
 */
export async function transformColumn(
  db: DrizzleDB,
  table: string,
  column: string,
  transform: string,
  whereClause?: string
): Promise<void> {
  const where = whereClause ? ` WHERE ${whereClause}` : '';
  console.log(
    `[Migration] Transforming ${table}.${column} with: ${transform}${where}`
  );

  try {
    const query = `UPDATE ${table} SET ${column} = ${transform}${where}`;
    await db.run(sql.raw(query));
    console.log(`[Migration] ✓ Column transformed`);
  } catch (error) {
    console.error(`[Migration] Failed to transform column:`, error);
    throw error;
  }
}

/**
 * Copy data from one column to another
 * Useful when renaming or restructuring data
 *
 * @param db - Drizzle database instance
 * @param table - Table name
 * @param fromColumn - Source column
 * @param toColumn - Destination column
 * @param whereClause - Optional WHERE clause
 */
export async function copyColumn(
  db: DrizzleDB,
  table: string,
  fromColumn: string,
  toColumn: string,
  whereClause?: string
): Promise<void> {
  const where = whereClause ? ` WHERE ${whereClause}` : '';
  console.log(
    `[Migration] Copying ${table}.${fromColumn} → ${toColumn}${where}`
  );

  try {
    await db.run(
      sql.raw(`UPDATE ${table} SET ${toColumn} = ${fromColumn}${where}`)
    );
    console.log(`[Migration] ✓ Column copied`);
  } catch (error) {
    console.error(`[Migration] Failed to copy column:`, error);
    throw error;
  }
}

// ============================================================================
// METADATA MANAGEMENT
// ============================================================================

/**
 * Update _metadata.schema_version on all LOCAL-ONLY tables
 * This should be called after each successful migration
 *
 * NOTE: We only update *_local tables because:
 * - Synced tables are migrated server-side via RPC (ps_transform_v1_to_v2)
 * - When local data is uploaded, server RPC transforms it
 * - Local tables never go to server except via synced tables
 * - Updating synced tables would create conflicts with server migrations
 *
 * @param db - Drizzle database instance
 * @param version - New schema version to stamp
 */
export async function updateMetadataVersion(
  db: DrizzleDB,
  version: string
): Promise<void> {
  console.log(
    `[Migration] Updating all *_local view _metadata to version ${version}...`
  );

  // ONLY local views - synced tables are handled by server
  // Query through views (they expose _metadata column from Drizzle schema)
  const tables = [
    'profile_local',
    'language_local',
    'project_local',
    'quest_local',
    'asset_local',
    'tag_local',
    'quest_asset_link_local',
    'quest_tag_link_local',
    'asset_tag_link_local',
    'asset_content_link_local',
    'vote_local',
    'reports_local',
    'invite_local',
    'request_local',
    'notification_local',
    'profile_project_link_local',
    'project_language_link_local',
    'subscription_local',
    'blocked_users_local',
    'blocked_content_local',
    // Languoid/region tables (v1.1+)
    'languoid_local',
    'languoid_alias_local',
    'languoid_source_local',
    'languoid_property_local',
    'region_local',
    'region_alias_local',
    'region_source_local',
    'region_property_local',
    'languoid_region_local'
  ];

  let updatedTables = 0;
  let totalRecordsUpdated = 0;

  for (const table of tables) {
    try {
      // Check if view exists
      const viewExists = (await db.get(
        sql`SELECT COUNT(*) as count FROM sqlite_master WHERE type='view' AND name=${table}`
      )) as { count: number } | undefined;

      if (!viewExists || viewExists.count === 0) {
        continue;
      }

      // Update _metadata for records that don't already have this version
      // Query through the view - it exposes _metadata column
      // Use .run() for Drizzle-wrapped database
      const result = await db.run(
        sql.raw(`
        UPDATE ${table}
        SET _metadata = json_object('schema_version', '${version}')
        WHERE _metadata IS NULL 
           OR json_extract(_metadata, '$.schema_version') IS NULL
           OR json_extract(_metadata, '$.schema_version') != '${version}'
      `)
      );

      const changes = result.changes || 0;

      if (changes > 0) {
        console.log(`[Migration]   - Updated ${changes} record(s) in ${table}`);
        updatedTables++;
        totalRecordsUpdated += changes;
      }
    } catch (error) {
      // View might not exist - skip it
      console.log(`[Migration]   - Skipping ${table}: ${error}`);
    }
  }

  console.log(
    `[Migration] ✓ Updated _metadata on ${totalRecordsUpdated} record(s) across ${updatedTables} table(s)`
  );
}

/**
 * Get count of records that need migration for a specific table
 * Useful for progress tracking
 *
 * @param db - Drizzle database instance
 * @param table - Table name
 * @param currentVersion - Version to check against
 * @returns Number of records with _metadata.schema_version < currentVersion
 */
export async function getOutdatedRecordCount(
  db: DrizzleDB,
  table: string,
  currentVersion: string
): Promise<number> {
  try {
    const result = (await db.get(
      sql.raw(`
      SELECT COUNT(*) as count FROM ${table}
      WHERE _metadata IS NULL
         OR json_extract(_metadata, '$.schema_version') IS NULL
         OR json_extract(_metadata, '$.schema_version') < '${currentVersion}'
    `)
    )) as { count: number } | undefined;

    return result?.count || 0;
  } catch (error) {
    console.warn(`Could not get outdated record count for ${table}:`, error);
    return 0;
  }
}

// ============================================================================
// COLUMN EXISTENCE CHECK
// ============================================================================

/**
 * Check if a column exists in a table
 * Useful for idempotent migrations that might run multiple times
 *
 * @param db - Drizzle database instance
 * @param table - View name (e.g., 'asset_local') - will be converted to PowerSync table name
 * @param columnName - Column name to check
 * @returns true if column exists, false otherwise
 */
export async function columnExists(
  db: DrizzleDB,
  table: string,
  columnName: string
): Promise<boolean> {
  const psTableName = `ps_data_local__${table}`;

  try {
    const rawPowerSync = db?.rawPowerSync;
    if (!rawPowerSync?.execute) {
      // Fallback: try to check via pragma through the view
      const result = (await db.get(
        sql.raw(
          `SELECT COUNT(*) as count FROM pragma_table_info('${psTableName}') WHERE name = '${columnName}'`
        )
      )) as { count: number } | undefined;
      return (result?.count || 0) > 0;
    }

    const result = await rawPowerSync.getAll(
      `SELECT COUNT(*) as count FROM pragma_table_info('${psTableName}') WHERE name = ?`,
      [columnName]
    );
    return (result?.[0]?.count || 0) > 0;
  } catch (error) {
    console.warn(
      `[Migration] Could not check if column ${columnName} exists in ${table}:`,
      error
    );
    return false;
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Update records in batches to avoid locking the database
 * Useful for large migrations
 *
 * @param db - Drizzle database instance
 * @param table - Table name
 * @param updateSql - SQL UPDATE statement (without WHERE)
 * @param whereClause - WHERE clause to identify records to update
 * @param batchSize - Number of records to update per batch (default: 1000)
 * @param onProgress - Optional callback for progress updates
 */
export async function updateInBatches(
  db: DrizzleDB,
  table: string,
  updateSql: string,
  whereClause: string,
  batchSize = 1000,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  console.log(`[Migration] Batch updating ${table}...`);

  // Get total count
  const countResult = (await db.get(
    sql.raw(`SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`)
  )) as { count: number } | undefined;
  const total = countResult?.count || 0;

  if (total === 0) {
    console.log(`[Migration] No records to update in ${table}`);
    return;
  }

  console.log(
    `[Migration] Updating ${total} record(s) in batches of ${batchSize}`
  );

  let updated = 0;

  while (updated < total) {
    await db.run(
      sql.raw(`${updateSql} WHERE ${whereClause} LIMIT ${batchSize}`)
    );

    updated += batchSize;

    if (onProgress) {
      onProgress(Math.min(updated, total), total);
    }

    console.log(
      `[Migration]   - Progress: ${Math.min(updated, total)}/${total}`
    );
  }

  console.log(`[Migration] ✓ Batch update complete`);
}

/**
 * TESTING UTILITY: Reset all metadata to a specific version
 * Use this to force migrations to re-run during development/testing
 *
 * @param db - Database instance
 * @param version - Version to reset to (e.g., '1.0' or '0.0')
 */
export async function resetMetadataVersionForTesting(
  db: DrizzleDB,
  version: string
): Promise<void> {
  console.log(
    `[Migration] ⚠️  TESTING: Resetting all *_local metadata to version ${version}...`
  );

  const tables = [
    'profile_local',
    'language_local',
    'project_local',
    'quest_local',
    'asset_local',
    'tag_local',
    'quest_asset_link_local',
    'quest_tag_link_local',
    'asset_tag_link_local',
    'asset_content_link_local',
    'vote_local',
    'reports_local',
    'invite_local',
    'request_local',
    'notification_local',
    'profile_project_link_local',
    'project_language_link_local',
    'subscription_local',
    'blocked_users_local',
    'blocked_content_local',
    // Languoid/region tables (v1.1+)
    'languoid_local',
    'languoid_alias_local',
    'languoid_source_local',
    'languoid_property_local',
    'region_local',
    'region_alias_local',
    'region_source_local',
    'region_property_local',
    'languoid_region_local'
  ];

  for (const table of tables) {
    try {
      const result = await db.run(
        sql.raw(`
                UPDATE ${table}
                SET _metadata = json_object('schema_version', '${version}')
                WHERE _metadata IS NOT NULL
            `)
      );

      console.log(
        `[Migration]   - Reset ${table}: ${result?.changes || 0} records`
      );
    } catch (error) {
      console.log(`[Migration]   - Skipping ${table}: ${error}`);
    }
  }

  console.log(`[Migration] ✓ Metadata reset complete`);
}
