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
 * All migrations use raw database access:
 * - Schema migrations (ALTER TABLE) use `db.execute(...)` with raw table names
 * - Data migrations (UPDATE/INSERT) use `db.execute(...)` with raw table names
 * - Queries use `db.getAll(...)` for direct SQL access
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

import type { DrizzleDB } from './index';

// Re-export for convenience in migration files

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
  const psTableName = getRawTableName(table);

  try {
    await db.execute(`ALTER TABLE ${psTableName} ADD COLUMN ${columnDef}`);
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
  const psTableName = getRawTableName(table);

  try {
    // Try direct rename (SQLite 3.25.0+)
    await db.execute(
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
  const psTableName = getRawTableName(table);

  try {
    await db.execute(`ALTER TABLE ${psTableName} DROP COLUMN ${columnName}`);
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
    await db.execute(query);
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
    await db.execute(`UPDATE ${table} SET ${toColumn} = ${fromColumn}${where}`);
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
    `[Migration] Updating all *_local raw PowerSync tables _metadata to version ${version}...`
  );

  // CRITICAL: Update raw PowerSync tables directly, not views
  // PowerSync stores data as JSON in the 'data' column of raw tables (ps_data_local__*)
  // We must update the JSON structure directly so getMinimumSchemaVersion can read it
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
      // Get raw PowerSync table name
      const rawTableName = getRawTableName(table);

      // Check if raw table exists
      const tableExistsResult = await db.getAll(
        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
        [rawTableName]
      );
      const tableExists = (tableExistsResult[0] as { count?: number }) || null;

      if (!tableExists?.count) {
        continue;
      }

      // Count records that need updating
      const countResult = await db.getAll(
        `SELECT COUNT(*) as count FROM ${rawTableName}
         WHERE data IS NULL
            OR data = ''
            OR data = '{}'
            OR json_extract(data, '$._metadata') IS NULL
            OR json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') IS NULL
            OR json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') != '${version}'`,
        []
      );
      const countData = (countResult[0] as { count?: number }) || null;
      const recordCount = countData?.count ?? 0;

      if (recordCount === 0) {
        console.log(
          `[Migration]   - ${rawTableName}: Already at version ${version}`
        );
        continue;
      }

      // Update _metadata in raw JSON data column
      // _metadata is stored as a stringified JSON string, so we parse it before updating
      await db.execute(`
        UPDATE ${rawTableName}
        SET data = CASE
          WHEN data IS NULL OR data = '' OR data = '{}' THEN
            json_object('_metadata', json('{"schema_version":"${version}"}'))
          WHEN json_extract(data, '$._metadata') IS NULL THEN
            json_set(
              data,
              '$._metadata',
              json('{"schema_version":"${version}"}')
            )
          ELSE
            json_set(
              data,
              '$._metadata',
              json_set(
                json(json_extract(data, '$._metadata')),
                '$.schema_version',
                '${version}'
              )
            )
        END
        WHERE data IS NULL
           OR data = ''
           OR data = '{}'
           OR json_extract(data, '$._metadata') IS NULL
           OR json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') IS NULL
           OR json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') != '${version}'
      `);

      console.log(
        `[Migration]   - Updated ${rawTableName}: ${recordCount} records`
      );
      updatedTables++;
      totalRecordsUpdated += recordCount;
    } catch (error) {
      // Table might not exist - skip it
      console.log(`[Migration]   - Skipping ${table}: ${String(error)}`);
    }
  }

  console.log(
    `[Migration] ✓ Updated _metadata across ${updatedTables} table(s), ${totalRecordsUpdated} total records`
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
    const result = await db.getAll(
      `
      SELECT COUNT(*) as count FROM ${table}
      WHERE _metadata IS NULL
         OR json_extract(_metadata, '$.schema_version') IS NULL
         OR json_extract(_metadata, '$.schema_version') < '${currentVersion}'
    `,
      []
    );
    const countData = (result[0] as { count?: number }) || null;
    return countData?.count ?? 0;
  } catch (error) {
    console.warn(`Could not get outdated record count for ${table}:`, error);
    return 0;
  }
}

// ============================================================================
// JSON-FIRST MIGRATION UTILITIES
// ============================================================================

/**
 * JSON-first migration utilities for reading legacy fields from raw PowerSync JSON storage.
 * These utilities allow migrations to read legacy fields even after they've been removed
 * from Drizzle views, enabling v0→latest migrations.
 *
 * PowerSync stores data as JSON in `ps_data_local__{view}` and `ps_data__{view}` tables.
 * The `data` column contains the full JSON object with all fields.
 */

type RawPowerSyncScope = 'local' | 'synced';

/**
 * Get the raw PowerSync table name for a view
 * @param viewName - View name (e.g., 'project_local' or 'project')
 * @param scope - Optional override. If not provided, auto-detected from '_local' suffix
 * @returns Raw PowerSync table name (e.g., 'ps_data_local__project_local' or 'ps_data__project')
 */
export function getRawTableName(
  viewName: string,
  scope?: RawPowerSyncScope
): string {
  // Auto-detect scope from _local suffix if not explicitly provided
  const detectedScope: RawPowerSyncScope =
    scope ?? (viewName.endsWith('_local') ? 'local' : 'synced');

  if (detectedScope === 'local') {
    return `ps_data_local__${viewName}`;
  }
  return `ps_data__${viewName}`;
}

// ============================================================================
// TABLE CREATION
// ============================================================================

/**
 * Ensure a PowerSync raw table exists, creating it if necessary
 * PowerSync tables have a simple structure: id (TEXT PRIMARY KEY) and data (TEXT)
 * This is useful when migrations need to insert data into tables that PowerSync
 * hasn't created yet (e.g., when migrations run before PowerSync.init() completes)
 *
 * @param db - Drizzle database instance
 * @param viewName - View name (e.g., 'languoid_local')
 * @param scope - 'local' or 'synced' (default: 'local')
 */
export async function ensureTableExists(
  db: DrizzleDB,
  viewName: string,
  scope: RawPowerSyncScope = 'local'
): Promise<void> {
  const rawTableName = getRawTableName(viewName, scope);

  // Check if table already exists
  const exists = await rawTableExists(db, viewName, scope);
  if (exists) {
    console.log(`[Migration] Table ${rawTableName} already exists`);
    return;
  }

  console.log(`[Migration] Creating PowerSync table ${rawTableName}...`);

  try {
    // PowerSync tables have a simple structure: id (PRIMARY KEY) and data (TEXT JSON)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ${rawTableName} (
        id TEXT PRIMARY KEY,
        data TEXT
      )
    `);
    console.log(`[Migration] ✓ Created table ${rawTableName}`);
  } catch (error) {
    console.error(`[Migration] Failed to create table ${rawTableName}:`, error);
    throw error;
  }
}

/**
 * Generate JSON extract SELECT clause for columns from raw PowerSync JSON data
 * Converts column names to json_extract(data, '$.column_name') as column_name
 *
 * @param columns - Array of column names to extract
 * @param indent - Optional indentation string (default: '            ')
 * @returns SQL SELECT clause fragment with JSON extracts
 *
 * @example
 * jsonExtractColumns(['id', 'name', 'active'])
 * // Returns: "json_extract(data, '$.id') as id,\n            json_extract(data, '$.name') as name,\n            json_extract(data, '$.active') as active"
 */
export function jsonExtractColumns(
  columns: string[],
  indent = '            '
): string {
  return columns
    .map((col) => `json_extract(data, '$.${col}') as ${col}`)
    .join(`,\n${indent}`);
}

/**
 * Check if a raw PowerSync table exists
 * Uses sqlite_master to check table existence
 *
 * @param db - Drizzle database instance
 * @param viewName - View name (e.g., 'project_local')
 * @param scope - 'local' or 'synced' (default: 'local')
 * @returns true if table exists, false otherwise
 */
export async function rawTableExists(
  db: DrizzleDB,
  viewName: string,
  scope: RawPowerSyncScope = 'local'
): Promise<boolean> {
  const rawTableName = getRawTableName(viewName, scope);

  try {
    const result = await db.getAll(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
      [rawTableName]
    );
    const countData = (result[0] as { count?: number }) || null;
    return (countData?.count ?? 0) > 0;
  } catch (error) {
    console.warn(
      `[Migration] Could not check if raw table ${rawTableName} exists:`,
      error
    );
    return false;
  }
}

/**
 * Check if a JSON key exists in the data column of a raw PowerSync table
 * Checks if json_extract returns a non-null value for any record
 *
 * @param db - Drizzle database instance
 * @param viewName - View name (e.g., 'project_local')
 * @param jsonPath - JSON path (e.g., '$.target_language_id')
 * @param scope - 'local' or 'synced' (default: 'local')
 * @returns true if key exists in at least one record, false otherwise
 */
export async function rawJsonKeyExists(
  db: DrizzleDB,
  viewName: string,
  jsonPath: string,
  scope: RawPowerSyncScope = 'local'
): Promise<boolean> {
  const rawTableName = getRawTableName(viewName, scope);
  const query = `SELECT COUNT(*) as count FROM ${rawTableName} WHERE json_extract(data, '${jsonPath}') IS NOT NULL`;

  try {
    const result = await db.getAll(query, []);
    const countData = (result[0] as { count?: number }) || null;
    return (countData?.count ?? 0) > 0;
  } catch (error) {
    console.warn(
      `[Migration] Could not check if JSON key ${jsonPath} exists in ${rawTableName}:`,
      error
    );
    return false;
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
  const psTableName = getRawTableName(table);

  try {
    const result = await db.getAll(
      `SELECT COUNT(*) as count FROM pragma_table_info('${psTableName}') WHERE name = '${columnName}'`,
      []
    );
    const countData = (result[0] as { count?: number }) || null;
    return (countData?.count ?? 0) > 0;
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
  const countResult = await db.getAll(
    `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`,
    []
  );
  const countData = (countResult[0] as { count?: number }) || null;
  const total = countData?.count ?? 0;

  if (total === 0) {
    console.log(`[Migration] No records to update in ${table}`);
    return;
  }

  console.log(
    `[Migration] Updating ${total} record(s) in batches of ${batchSize}`
  );

  let updated = 0;

  while (updated < total) {
    await db.execute(`${updateSql} WHERE ${whereClause} LIMIT ${batchSize}`);

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
      await db.execute(`
                UPDATE ${table}
                SET _metadata = json_object('schema_version', '${version}')
                WHERE _metadata IS NOT NULL
            `);

      console.log(`[Migration]   - Reset ${table}`);
    } catch (error) {
      console.log(`[Migration]   - Skipping ${table}: ${String(error)}`);
    }
  }

  console.log(`[Migration] ✓ Metadata reset complete`);
}
