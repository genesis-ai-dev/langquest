/**
 * Migration: 1.0 → 2.0
 *
 * PURPOSE: Add languoid support to local tables (BREAKING CHANGE)
 *
 * This migration handles offline projects that were created before the
 * languoid system existed. The server migration does the same transformation
 * for synced data.
 *
 * Changes:
 * 1. Create project_language_link_local records from project.target_language_id
 *    (old projects may have target_language_id but no link record)
 * 2. Link to existing synced languoids where available
 * 3. Create languoid_local records for any languages that don't have languoids
 * 4. Populate languoid_id in project_language_link_local and asset_content_link_local
 *
 * CRITICAL: This migration must handle FOUR scenarios:
 * 1. Old projects with project.target_language_id but no project_language_link record
 * 2. language_id points to a LOCAL language (language_local) - created offline
 * 3. language_id points to a SYNCED language (language via PowerSync) - downloaded project
 * 4. Neither - language_id exists but language record was not synced (limited sync rules)
 *
 * For each case, we check if a matching languoid already exists (synced or local).
 * If not, we create a new languoid_local record.
 *
 * JSON-FIRST MIGRATION:
 * This migration reads legacy fields (target_language_id, source_language_id) from raw
 * PowerSync JSON storage (ps_data_local__*.data) instead of view columns. This allows
 * the migration to work even after these columns are removed from Drizzle views.
 *
 * NOTE: The languoid_id and ui_languoid_id columns are already defined in the Drizzle schema.
 * PowerSync creates tables with all schema-defined columns automatically.
 * DO NOT use addColumn() for schema-defined columns - it corrupts raw PowerSync tables.
 * This migration only handles DATA transformation for existing records.
 */

import type { Migration } from './index';
import {
  getRawTableName,
  jsonExtractColumns,
  rawJsonKeyExists,
  rawTableExists
} from './utils';

export const migration_1_0_to_2_0: Migration = {
  fromVersion: '1.0',
  toVersion: '2.0',
  description: 'Add languoid support for offline projects (breaking change)',

  async migrate(db, onProgress) {
    console.log('[Migration 1.0→2.0] Starting languoid migration...');

    // NOTE: We do NOT use addColumn() for ui_languoid_id, languoid_id columns because:
    // 1. These columns are already defined in the Drizzle schema (drizzleSchemaColumns.ts)
    // 2. PowerSync creates local-only tables with ALL schema-defined columns
    // 3. Using addColumn() on raw PowerSync tables corrupts the table structure
    // 4. This migration only needs to handle DATA transformation, not schema changes

    // Preflight: Verify raw tables exist
    const projectLocalRawExists = await rawTableExists(
      db,
      'project_local',
      'local'
    );
    const projectSyncedRawExists = await rawTableExists(
      db,
      'project',
      'synced'
    );
    const assetContentLinkRawExists = await rawTableExists(
      db,
      'asset_content_link_local',
      'local'
    );

    if (!projectLocalRawExists && !projectSyncedRawExists) {
      console.log(
        '[Migration 1.0→2.0] No raw project tables found, skipping project migration'
      );
    }

    // Step 1: Create project_language_link_local records from project.target_language_id
    // JSON-FIRST: Read legacy target_language_id from raw PowerSync JSON storage
    // This handles old projects created before project_language_link existed
    // These projects have target_language_id in JSON but no link record
    if (onProgress)
      onProgress(1, 4, 'Creating missing project_language_link records');
    console.log(
      '[Migration 1.0→2.0] Creating project_language_link_local from raw JSON target_language_id...'
    );

    // Check if legacy field exists in JSON before processing
    const hasTargetLanguageIdLocal =
      projectLocalRawExists &&
      (await rawJsonKeyExists(
        db,
        'project_local',
        '$.target_language_id',
        'local'
      ));
    const hasTargetLanguageIdSynced =
      projectSyncedRawExists &&
      (await rawJsonKeyExists(db, 'project', '$.target_language_id', 'synced'));

    if (hasTargetLanguageIdLocal) {
      // Create project_language_link_local records from raw JSON using SQL
      // CRITICAL: PowerSync stores data as JSON in 'data' column, not individual columns
      // We must insert into the raw PowerSync table with id and data columns only
      const projectLocalTable = getRawTableName('project_local');
      const pllLocalTable = getRawTableName('project_language_link_local');
      await db.execute(`
        WITH project_data AS (
          SELECT 
            id,
            ${jsonExtractColumns([
              'target_language_id',
              'active',
              'download_profiles',
              'created_at',
              'last_updated',
              '_metadata'
            ])}
          FROM ${projectLocalTable}
        )
        INSERT OR IGNORE INTO ${pllLocalTable} (
          id,
          data
        )
        SELECT 
          p.id || '_target_' || p.target_language_id,
          json_object(
            'id', p.id || '_target_' || p.target_language_id,
            'project_id', p.id,
            'language_id', p.target_language_id,
            'languoid_id', p.target_language_id,
            'language_type', 'target',
            'active', 1,
            'source', 'local',
            'download_profiles', COALESCE(p.download_profiles, json('[]')),
            'created_at', COALESCE(p.created_at, datetime('now')),
            'last_updated', COALESCE(p.last_updated, datetime('now')),
            '_metadata', COALESCE(p._metadata, json('{"schema_version":"1.0"}'))
          )
        FROM project_data p
        WHERE p.target_language_id IS NOT NULL
          AND p.active = 1
          AND NOT EXISTS (
            SELECT 1 FROM ${pllLocalTable} pll_raw
            WHERE json_extract(pll_raw.data, '$.project_id') = p.id 
              AND json_extract(pll_raw.data, '$.language_type') = 'target'
          )
      `);

      console.log(
        '[Migration 1.0→2.0] ✓ Created project_language_link_local records from local projects'
      );
    }

    if (hasTargetLanguageIdSynced) {
      // Also check synced project table for projects that might be synced but missing link records
      // This can happen if the project was synced before the server migration ran
      // CRITICAL: PowerSync stores data as JSON in 'data' column, not individual columns
      const projectSyncedTable = getRawTableName('project', 'synced');
      const pllLocalTable = getRawTableName('project_language_link_local');
      await db.execute(`
        WITH project_data AS (
          SELECT 
            id,
            ${jsonExtractColumns([
              'target_language_id',
              'active',
              'download_profiles',
              'created_at',
              'last_updated'
            ])}
          FROM ${projectSyncedTable}
        )
        INSERT OR IGNORE INTO ${pllLocalTable} (
          id,
          data
        )
        SELECT 
          p.id || '_target_' || p.target_language_id,
          json_object(
            'id', p.id || '_target_' || p.target_language_id,
            'project_id', p.id,
            'language_id', p.target_language_id,
            'languoid_id', p.target_language_id,
            'language_type', 'target',
            'active', 1,
            'source', 'local',
            'download_profiles', COALESCE(p.download_profiles, json('[]')),
            'created_at', COALESCE(p.created_at, datetime('now')),
            'last_updated', COALESCE(p.last_updated, datetime('now')),
            '_metadata', json('{"schema_version":"1.0"}')
          )
        FROM project_data p
        WHERE p.target_language_id IS NOT NULL
          AND p.active = 1
          AND NOT EXISTS (
            SELECT 1 FROM ${getRawTableName('project_language_link')} pll_raw
            WHERE json_extract(pll_raw.data, '$.project_id') = p.id 
              AND json_extract(pll_raw.data, '$.language_type') = 'target'
          )
          AND NOT EXISTS (
            SELECT 1 FROM ${pllLocalTable} pll_raw
            WHERE json_extract(pll_raw.data, '$.project_id') = p.id 
              AND json_extract(pll_raw.data, '$.language_type') = 'target'
          )
      `);

      console.log(
        '[Migration 1.0→2.0] ✓ Created project_language_link_local records from synced projects'
      );
    }

    console.log(
      '[Migration 1.0→2.0] ✓ project_language_link_local records created'
    );

    // Step 2: Try to use existing synced languoids if they match the language_id
    // The server migration uses language_id as the languoid_id, so check if that languoid exists
    if (onProgress) onProgress(2, 4, 'Checking for existing synced languoids');
    console.log(
      '[Migration 1.0→2.0] Checking for existing synced languoids...'
    );

    // Check if languoid tables exist
    // NOTE: Migrations run BEFORE PowerSync.init() completes, so tables may not exist yet.
    // PowerSync creates tables based on schema when init() runs, but migrations need to
    // handle the case where tables don't exist yet (especially synced tables, which only
    // exist after data is synced). languoid_local should exist after PowerSync.init(),
    // but we check anyway to be safe.
    const languoidSyncedExists = await rawTableExists(db, 'languoid', 'synced');
    const languoidLocalExists = await rawTableExists(db, 'languoid', 'local');

    // Build conditional EXISTS clauses that safely handle missing tables
    // Use the same pattern as Step 4 to avoid "no such table" errors
    const languoidSyncedTable = languoidSyncedExists
      ? getRawTableName('languoid', 'synced')
      : null;
    const languoidLocalTable = languoidLocalExists
      ? getRawTableName('languoid', 'local')
      : null;

    // Helper to build EXISTS clause for synced languoid (returns '0=1' if table doesn't exist)
    // NOTE: languoid ID is stored as the table's primary key (id column), not in JSON data
    const existsSyncedLanguoid = (idExpr: string) =>
      languoidSyncedTable
        ? `EXISTS (SELECT 1 FROM ${languoidSyncedTable} WHERE id = ${idExpr})`
        : '0=1'; // Always false if table doesn't exist

    // Helper to build EXISTS clause for local languoid (returns '0=1' if table doesn't exist)
    // NOTE: languoid ID is stored as the table's primary key (id column), not in JSON data
    const existsLocalLanguoid = (idExpr: string) =>
      languoidLocalTable
        ? `EXISTS (SELECT 1 FROM ${languoidLocalTable} WHERE id = ${idExpr})`
        : '0=1'; // Always false if table doesn't exist

    // Update project_language_link_local with synced languoid if it exists
    // (Server migration creates languoid with id = language_id)
    // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
    const pllRawTableStep2 = getRawTableName('project_language_link_local');
    try {
      await db.execute(`
        UPDATE ${pllRawTableStep2}
        SET data = json_set(
          data,
          '$.languoid_id',
          json_extract(data, '$.language_id')
        )
        WHERE json_extract(data, '$.languoid_id') IS NULL
          AND json_extract(data, '$.language_id') IS NOT NULL
          AND (
            ${existsSyncedLanguoid(`json_extract(data, '$.language_id')`)}
            OR ${existsLocalLanguoid(`json_extract(data, '$.language_id')`)}
          )
      `);
    } catch (error) {
      console.warn(
        '[Migration 1.0→2.0] Could not link synced languoids to project_language_link_local:',
        error
      );
      // Continue migration - this is not critical
    }

    // Same for asset_content_link_local
    // JSON-FIRST: Read source_language_id from raw JSON if needed
    if (assetContentLinkRawExists) {
      const hasSourceLanguageId = await rawJsonKeyExists(
        db,
        'asset_content_link_local',
        '$.source_language_id',
        'local'
      );

      if (hasSourceLanguageId) {
        // Update using json_set() to update JSON data field
        // CRITICAL: Update raw PowerSync table directly
        const aclLocalTable = getRawTableName('asset_content_link_local');
        try {
          await db.execute(`
            UPDATE ${aclLocalTable}
            SET data = json_set(
              data,
              '$.languoid_id',
              json_extract(data, '$.source_language_id')
            )
            WHERE json_extract(data, '$.languoid_id') IS NULL
              AND json_extract(data, '$.source_language_id') IS NOT NULL
              AND (
                ${existsSyncedLanguoid(`json_extract(data, '$.source_language_id')`)}
                OR ${existsLocalLanguoid(`json_extract(data, '$.source_language_id')`)}
              )
          `);
        } catch (error) {
          console.warn(
            '[Migration 1.0→2.0] Could not link synced languoids to asset_content_link_local:',
            error
          );
          // Continue migration - this is not critical
        }
      } else {
        // Fallback: use raw table directly (newer data may not have source_language_id in JSON)
        // Step 3 already created all necessary languoid_local records, so we can safely
        // set languoid_id = source_language_id for all records where languoid_id IS NULL
        // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
        const aclLocalTable = getRawTableName('asset_content_link_local');
        try {
          await db.execute(`
            UPDATE ${aclLocalTable}
            SET data = json_set(
              data,
              '$.languoid_id',
              json_extract(data, '$.source_language_id')
            )
            WHERE json_extract(data, '$.languoid_id') IS NULL
              AND json_extract(data, '$.source_language_id') IS NOT NULL
          `);
        } catch (error) {
          console.warn(
            '[Migration 1.0→2.0] Could not link synced languoids to asset_content_link_local (fallback):',
            error
          );
          // Continue migration - this is not critical
        }
      }
    }

    console.log('[Migration 1.0→2.0] ✓ Synced languoid references applied');

    // Step 3: Create languoid_local records for any remaining language references
    // Check BOTH synced and local language tables, and create languoid_local if missing
    if (onProgress)
      onProgress(3, 4, 'Creating languoid records for unmatched languages');
    console.log(
      '[Migration 1.0→2.0] Creating languoid_local for unmatched languages...'
    );

    // Build conditional EXISTS clauses based on table existence
    // languoidSyncedExists, languoidLocalExists, languoidSyncedTable, and languoidLocalTable
    // are already checked/declared in Step 2

    // Helper to build NOT EXISTS clause for synced languoid
    // NOTE: languoid ID is stored as the table's primary key (id column), not in JSON data
    const notExistsSyncedLanguoid = (idExpr: string) =>
      languoidSyncedTable
        ? `AND NOT EXISTS (SELECT 1 FROM ${languoidSyncedTable} WHERE id = ${idExpr})`
        : '';

    // Helper to build NOT EXISTS clause for local languoid
    // NOTE: languoid ID is stored as the table's primary key (id column), not in JSON data
    const notExistsLocalLanguoid = (idExpr: string) =>
      languoidLocalTable
        ? `AND NOT EXISTS (SELECT 1 FROM ${languoidLocalTable} WHERE id = ${idExpr})`
        : '';

    // Create from LOCAL language table first
    // CRITICAL: PowerSync stores data as JSON in 'data' column, not individual columns
    // Ensure languoid_local table exists (PowerSync should create it, but we check anyway)
    const languoidLocalTableName =
      languoidLocalTable || getRawTableName('languoid_local');
    await db.execute(
      `
      WITH language_data AS (
        SELECT 
          id,
          ${jsonExtractColumns([
            'english_name',
            'native_name',
            'ui_ready',
            'active',
            'creator_id',
            'created_at',
            'last_updated',
            '_metadata'
          ])}
        FROM ${getRawTableName('language_local')}
      ),
      pll_data AS (
        SELECT 
          ${jsonExtractColumns([
            'id',
            'project_id',
            'language_id',
            'languoid_id'
          ])}
        FROM ${getRawTableName('project_language_link_local')}
      )
      INSERT OR IGNORE INTO ${languoidLocalTableName} (
        id,
        data
      )
      SELECT DISTINCT
        l.id,
        json_object(
          'id', l.id,
          'name', COALESCE(l.english_name, l.native_name, 'Unknown'),
          'level', 'language',
          'ui_ready', COALESCE(l.ui_ready, 0),
          'active', 1,
          'source', 'local',
          'creator_id', l.creator_id,
          'created_at', COALESCE(l.created_at, datetime('now')),
          'last_updated', COALESCE(l.last_updated, datetime('now')),
          '_metadata', COALESCE(l._metadata, json('{"schema_version":"1.0"}'))
        )
      FROM language_data l
      INNER JOIN pll_data pll ON pll.language_id = l.id
      WHERE pll.languoid_id IS NULL
        AND l.active = 1
        ${notExistsSyncedLanguoid('l.id')}
        ${notExistsLocalLanguoid('l.id')}
    `
    );

    // Create from SYNCED language table (for downloaded projects where languoid wasn't synced)
    // CRITICAL: PowerSync stores data as JSON in 'data' column, not individual columns
    await db.execute(
      `
      WITH language_data AS (
        SELECT 
          id,
          ${jsonExtractColumns([
            'english_name',
            'native_name',
            'ui_ready',
            'active',
            'creator_id',
            'created_at',
            'last_updated'
          ])}
        FROM ${getRawTableName('language')}
      ),
      pll_data AS (
        SELECT 
          ${jsonExtractColumns([
            'id',
            'project_id',
            'language_id',
            'languoid_id'
          ])}
        FROM ${getRawTableName('project_language_link_local')}
      )
      INSERT OR IGNORE INTO ${languoidLocalTableName} (
        id,
        data
      )
      SELECT DISTINCT
        l.id,
        json_object(
          'id', l.id,
          'name', COALESCE(l.english_name, l.native_name, 'Unknown'),
          'level', 'language',
          'ui_ready', COALESCE(l.ui_ready, 0),
          'active', 1,
          'source', 'local',
          'creator_id', l.creator_id,
          'created_at', COALESCE(l.created_at, datetime('now')),
          'last_updated', COALESCE(l.last_updated, datetime('now')),
          '_metadata', json('{"schema_version":"1.0"}')
        )
      FROM language_data l
      INNER JOIN pll_data pll ON pll.language_id = l.id
      WHERE pll.languoid_id IS NULL
        AND l.active = 1
        ${notExistsSyncedLanguoid('l.id')}
        ${notExistsLocalLanguoid('l.id')}
    `
    );

    // Handle asset_content_link_local - from local language
    // JSON-FIRST: Read source_language_id from raw JSON
    if (assetContentLinkRawExists) {
      const hasSourceLanguageId = await rawJsonKeyExists(
        db,
        'asset_content_link_local',
        '$.source_language_id',
        'local'
      );

      if (hasSourceLanguageId) {
        // Create languoids from language_local for source_language_id in asset_content_link_local JSON
        // Extract JSON fields into columns first, then query normally
        const aclLocalTable = getRawTableName('asset_content_link_local');
        await db.execute(
          `
          WITH acl_data AS (
            SELECT 
              id,
              ${jsonExtractColumns(['source_language_id'])}
            FROM ${aclLocalTable}
            WHERE json_extract(data, '$.source_language_id') IS NOT NULL
          )
          INSERT OR IGNORE INTO ${languoidLocalTableName} (
            id,
            data
          )
          WITH language_data AS (
            SELECT 
              id,
              ${jsonExtractColumns([
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated',
                '_metadata'
              ])}
            FROM ${getRawTableName('language_local')}
          )
          SELECT DISTINCT
            l.id,
            json_object(
              'id', l.id,
              'name', COALESCE(l.english_name, l.native_name, 'Unknown'),
              'level', 'language',
              'ui_ready', COALESCE(l.ui_ready, 0),
              'active', 1,
              'source', 'local',
              'creator_id', l.creator_id,
              'created_at', COALESCE(l.created_at, datetime('now')),
              'last_updated', COALESCE(l.last_updated, datetime('now')),
              '_metadata', COALESCE(l._metadata, json('{"schema_version":"1.0"}'))
            )
          FROM language_data l
          INNER JOIN acl_data ON acl_data.source_language_id = l.id
          WHERE l.active = 1
            ${notExistsSyncedLanguoid('l.id')}
            ${notExistsLocalLanguoid('l.id')}
        `
        );

        // Create languoids from synced language table
        await db.execute(
          `
          WITH acl_data AS (
            SELECT 
              id,
              ${jsonExtractColumns(['source_language_id'])}
            FROM ${aclLocalTable}
            WHERE json_extract(data, '$.source_language_id') IS NOT NULL
          )
          INSERT OR IGNORE INTO ${languoidLocalTableName} (
            id,
            data
          )
          WITH language_data AS (
            SELECT 
              id,
              ${jsonExtractColumns([
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated'
              ])}
            FROM ${getRawTableName('language')}
          )
          SELECT DISTINCT
            l.id,
            json_object(
              'id', l.id,
              'name', COALESCE(l.english_name, l.native_name, 'Unknown'),
              'level', 'language',
              'ui_ready', COALESCE(l.ui_ready, 0),
              'active', 1,
              'source', 'local',
              'creator_id', l.creator_id,
              'created_at', COALESCE(l.created_at, datetime('now')),
              'last_updated', COALESCE(l.last_updated, datetime('now')),
              '_metadata', json('{"schema_version":"1.0"}')
            )
          FROM language_data l
          INNER JOIN acl_data ON acl_data.source_language_id = l.id
          WHERE l.active = 1
            ${notExistsSyncedLanguoid('l.id')}
            ${notExistsLocalLanguoid('l.id')}
        `
        );
      } else {
        // Fallback: use view if JSON key doesn't exist (newer data)
        await db.execute(
          `
          WITH language_data AS (
            SELECT 
              id,
              ${jsonExtractColumns([
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated',
                '_metadata'
              ])}
            FROM ${getRawTableName('language_local')}
          ),
          acl_data AS (
            SELECT 
              ${jsonExtractColumns(['id', 'source_language_id', 'languoid_id'])}
            FROM ${getRawTableName('asset_content_link_local')}
          )
          INSERT OR IGNORE INTO ${languoidLocalTableName} (
            id,
            data
          )
          SELECT DISTINCT
            l.id,
            json_object(
              'id', l.id,
              'name', COALESCE(l.english_name, l.native_name, 'Unknown'),
              'level', 'language',
              'ui_ready', COALESCE(l.ui_ready, 0),
              'active', 1,
              'source', 'local',
              'creator_id', l.creator_id,
              'created_at', COALESCE(l.created_at, datetime('now')),
              'last_updated', COALESCE(l.last_updated, datetime('now')),
              '_metadata', COALESCE(l._metadata, json('{"schema_version":"1.0"}'))
            )
          FROM language_data l
          INNER JOIN acl_data acl ON acl.source_language_id = l.id
          WHERE acl.languoid_id IS NULL
            AND l.active = 1
            ${notExistsSyncedLanguoid('l.id')}
            ${notExistsLocalLanguoid('l.id')}
        `
        );

        await db.execute(
          `
          WITH language_data AS (
            SELECT 
              ${jsonExtractColumns([
                'id',
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated'
              ])}
            FROM ${getRawTableName('language', 'synced')}
          ),
          acl_data AS (
            SELECT 
              ${jsonExtractColumns(['id', 'source_language_id', 'languoid_id'])}
            FROM ${getRawTableName('asset_content_link_local')}
          )
          INSERT OR IGNORE INTO ${languoidLocalTableName} (
            id,
            data
          )
          SELECT DISTINCT
            l.id,
            json_object(
              'id', l.id,
              'name', COALESCE(l.english_name, l.native_name, 'Unknown'),
              'level', 'language',
              'ui_ready', COALESCE(l.ui_ready, 0),
              'active', 1,
              'source', 'local',
              'creator_id', l.creator_id,
              'created_at', COALESCE(l.created_at, datetime('now')),
              'last_updated', COALESCE(l.last_updated, datetime('now')),
              '_metadata', json('{"schema_version":"1.0"}')
            )
          FROM language_data l
          INNER JOIN acl_data acl ON acl.source_language_id = l.id
          WHERE acl.languoid_id IS NULL
            AND l.active = 1
            ${notExistsSyncedLanguoid('l.id')}
            ${notExistsLocalLanguoid('l.id')}
        `
        );
      }
    }

    // FALLBACK: For any remaining language_ids where neither language table has the record
    // (e.g., language was never synced due to sync rules), create a minimal languoid
    // Try to get language name from language_local or synced language table, fallback to "Unknown Language" if not found
    // Note: This handles languages that weren't matched in earlier steps (e.g., inactive languages or missing records)
    await db.execute(
      `
      WITH pll_data AS (
        SELECT 
          ${jsonExtractColumns([
            'id',
            'project_id',
            'language_id',
            'languoid_id'
          ])}
        FROM ${getRawTableName('project_language_link_local')}
      ),
      language_local_data AS (
        SELECT 
          id,
          ${jsonExtractColumns([
            'english_name',
            'native_name',
            'ui_ready',
            'active',
            'creator_id',
            'created_at',
            'last_updated',
            '_metadata'
          ])}
        FROM ${getRawTableName('language_local')}
      ),
      language_synced_data AS (
        SELECT 
          id,
          ${jsonExtractColumns([
            'english_name',
            'native_name',
            'ui_ready',
            'active',
            'creator_id',
            'created_at',
            'last_updated'
          ])}
        FROM ${getRawTableName('language')}
      ),
      language_data AS (
        SELECT 
          trim(id) as id,
          english_name,
          native_name,
          ui_ready,
          active,
          creator_id,
          created_at,
          last_updated,
          _metadata
        FROM language_local_data
        UNION ALL
        SELECT 
          trim(id) as id,
          english_name,
          native_name,
          ui_ready,
          active,
          creator_id,
          created_at,
          last_updated,
          NULL as _metadata
        FROM language_synced_data
        WHERE trim(id) NOT IN (SELECT trim(id) FROM language_local_data)
      )
      INSERT OR IGNORE INTO ${languoidLocalTableName} (
        id,
        data
      )
      SELECT DISTINCT
        trim(pll.language_id),
        json_object(
          'id', trim(pll.language_id),
          'name', COALESCE(
            NULLIF(trim(l.english_name), ''),
            NULLIF(trim(l.native_name), ''),
            'Unknown Language'
          ),
          'level', 'language',
          'ui_ready', COALESCE(l.ui_ready, 0),
          'active', 1,
          'source', 'local',
          'creator_id', l.creator_id,
          'created_at', COALESCE(l.created_at, datetime('now')),
          'last_updated', COALESCE(l.last_updated, datetime('now')),
          '_metadata', COALESCE(l._metadata, json('{"schema_version":"1.0"}'))
        )
      FROM pll_data pll
      LEFT JOIN language_data l ON trim(l.id) = trim(pll.language_id)
      WHERE pll.languoid_id IS NULL
        AND pll.language_id IS NOT NULL
        ${notExistsSyncedLanguoid('pll.language_id')}
        ${notExistsLocalLanguoid('pll.language_id')}
    `
    );

    // FALLBACK: For asset_content_link_local - create minimal languoids for remaining IDs
    if (assetContentLinkRawExists) {
      const hasSourceLanguageId = await rawJsonKeyExists(
        db,
        'asset_content_link_local',
        '$.source_language_id',
        'local'
      );

      if (hasSourceLanguageId) {
        // Create minimal languoids for remaining language_ids referenced in project_language_link_local
        // Extract JSON fields into columns first, then query normally
        // Try to get language name from language_local or synced language table, fallback to "Unknown Language" if not found
        const aclLocalTable = getRawTableName('asset_content_link_local');
        await db.execute(
          `
          WITH acl_data AS (
            SELECT 
              id,
              ${jsonExtractColumns(['source_language_id'])}
            FROM ${aclLocalTable}
            WHERE json_extract(data, '$.source_language_id') IS NOT NULL
          ),
          language_local_data AS (
            SELECT 
              ${jsonExtractColumns([
                'id',
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated',
                '_metadata'
              ])}
            FROM ${getRawTableName('language_local')}
          ),
          language_synced_data AS (
            SELECT 
              ${jsonExtractColumns([
                'id',
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated'
              ])}
            FROM ${getRawTableName('language')}
          ),
          language_data AS (
            SELECT 
              trim(id) as id,
              english_name,
              native_name,
              ui_ready,
              active,
              creator_id,
              created_at,
              last_updated,
              _metadata
            FROM language_local_data
            UNION ALL
            SELECT 
              trim(id) as id,
              english_name,
              native_name,
              ui_ready,
              active,
              creator_id,
              created_at,
              last_updated,
              NULL as _metadata
            FROM language_synced_data
            WHERE trim(id) NOT IN (SELECT trim(id) FROM language_local_data)
          )
          INSERT OR IGNORE INTO ${languoidLocalTableName} (
            id,
            data
          )
          SELECT DISTINCT
            trim(acl_data.source_language_id),
            json_object(
              'id', trim(acl_data.source_language_id),
              'name', COALESCE(
                NULLIF(trim(l.english_name), ''),
                NULLIF(trim(l.native_name), ''),
                'Unknown Language'
              ),
              'level', 'language',
              'ui_ready', COALESCE(l.ui_ready, 0),
              'active', 1,
              'source', 'local',
              'creator_id', l.creator_id,
              'created_at', COALESCE(l.created_at, datetime('now')),
              'last_updated', COALESCE(l.last_updated, datetime('now')),
              '_metadata', COALESCE(l._metadata, json('{"schema_version":"1.0"}'))
            )
          FROM acl_data
          LEFT JOIN language_data l ON trim(l.id) = trim(acl_data.source_language_id)
          WHERE acl_data.source_language_id IS NOT NULL
            ${notExistsSyncedLanguoid('acl_data.source_language_id')}
            ${notExistsLocalLanguoid('acl_data.source_language_id')}
        `
        );
      } else {
        // Fallback: use view if JSON key doesn't exist
        // Try to get language name from language_local or synced language table, fallback to "Unknown Language" if not found
        await db.execute(
          `
          WITH acl_data AS (
            SELECT 
              ${jsonExtractColumns(['id', 'source_language_id', 'languoid_id'])}
            FROM ${getRawTableName('asset_content_link_local')}
          ),
          language_local_data AS (
            SELECT 
              ${jsonExtractColumns([
                'id',
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated',
                '_metadata'
              ])}
            FROM ${getRawTableName('language_local')}
          ),
          language_synced_data AS (
            SELECT 
              ${jsonExtractColumns([
                'id',
                'english_name',
                'native_name',
                'ui_ready',
                'active',
                'creator_id',
                'created_at',
                'last_updated'
              ])}
            FROM ${getRawTableName('language')}
          ),
          language_data AS (
            SELECT 
              trim(id) as id,
              english_name,
              native_name,
              ui_ready,
              active,
              creator_id,
              created_at,
              last_updated,
              _metadata
            FROM language_local_data
            UNION ALL
            SELECT 
              trim(id) as id,
              english_name,
              native_name,
              ui_ready,
              active,
              creator_id,
              created_at,
              last_updated,
              NULL as _metadata
            FROM language_synced_data
            WHERE trim(id) NOT IN (SELECT trim(id) FROM language_local_data)
          )
          INSERT OR IGNORE INTO ${languoidLocalTableName} (
            id,
            data
          )
          SELECT DISTINCT
            trim(acl.source_language_id),
            json_object(
              'id', trim(acl.source_language_id),
              'name', COALESCE(
                NULLIF(trim(l.english_name), ''),
                NULLIF(trim(l.native_name), ''),
                'Unknown Language'
              ),
              'level', 'language',
              'ui_ready', COALESCE(l.ui_ready, 0),
              'active', 1,
              'source', 'local',
              'creator_id', l.creator_id,
              'created_at', COALESCE(l.created_at, datetime('now')),
              'last_updated', COALESCE(l.last_updated, datetime('now')),
              '_metadata', COALESCE(l._metadata, json('{"schema_version":"1.0"}'))
            )
          FROM acl_data acl
          LEFT JOIN language_data l ON trim(l.id) = trim(acl.source_language_id)
          WHERE acl.languoid_id IS NULL
            AND acl.source_language_id IS NOT NULL
            ${notExistsSyncedLanguoid('acl.source_language_id')}
            ${notExistsLocalLanguoid('acl.source_language_id')}
        `
        );
      }
    }

    console.log('[Migration 1.0→2.0] ✓ languoid_local records created');

    // Step 4: Populate languoid_id references for all remaining records
    if (onProgress) onProgress(4, 4, 'Populating languoid_id references');
    console.log('[Migration 1.0→2.0] Populating languoid_id references...');

    // Update project_language_link_local.languoid_id
    // Step 3 already created all necessary languoid_local records, so we can safely
    // set languoid_id = language_id for all records where languoid_id IS NULL
    // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
    const pllRawTable = getRawTableName('project_language_link_local');
    await db.execute(
      `
      UPDATE ${pllRawTable}
      SET data = json_set(
        data,
        '$.languoid_id',
        json_extract(data, '$.language_id')
      )
      WHERE json_extract(data, '$.languoid_id') IS NULL
        AND json_extract(data, '$.language_id') IS NOT NULL
    `
    );

    // Update asset_content_link_local.languoid_id - check both synced and local languoids
    // JSON-FIRST: Read source_language_id from raw JSON if needed
    if (assetContentLinkRawExists) {
      const hasSourceLanguageId = await rawJsonKeyExists(
        db,
        'asset_content_link_local',
        '$.source_language_id',
        'local'
      );

      if (hasSourceLanguageId) {
        // Update languoid_id from raw JSON using json_set() to update JSON data field
        // CRITICAL: Update raw PowerSync table directly
        const aclLocalTable = getRawTableName('asset_content_link_local');
        await db.execute(
          `
          UPDATE ${aclLocalTable}
          SET data = json_set(
            data,
            '$.languoid_id',
            json_extract(data, '$.source_language_id')
          )
          WHERE json_extract(data, '$.languoid_id') IS NULL
            AND json_extract(data, '$.source_language_id') IS NOT NULL
        `
        );
      } else {
        // Fallback: use raw table directly (newer data may not have source_language_id in JSON)
        // Step 3 already created all necessary languoid_local records, so we can safely
        // set languoid_id = source_language_id for all records where languoid_id IS NULL
        // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
        const aclLocalTableFallback = getRawTableName(
          'asset_content_link_local'
        );
        await db.execute(
          `
          UPDATE ${aclLocalTableFallback}
          SET data = json_set(
            data,
            '$.languoid_id',
            json_extract(data, '$.source_language_id')
          )
          WHERE json_extract(data, '$.languoid_id') IS NULL
            AND json_extract(data, '$.source_language_id') IS NOT NULL
        `
        );
      }
    }

    // Log any remaining records without languoid_id for debugging
    const remainingPllResult = await db.getAll(
      `
      SELECT COUNT(*) as count FROM ${getRawTableName('project_language_link_local')}
      WHERE json_extract(data, '$.languoid_id') IS NULL 
        AND json_extract(data, '$.language_id') IS NOT NULL
    `
    );
    const remainingPll =
      (remainingPllResult[0] as { count?: number } | undefined)?.count ?? 0;

    const remainingAclResult = await db.getAll(
      `
      SELECT COUNT(*) as count FROM ${getRawTableName('asset_content_link_local')}
      WHERE json_extract(data, '$.languoid_id') IS NULL 
        AND json_extract(data, '$.source_language_id') IS NOT NULL
    `
    );
    const remainingAcl =
      (remainingAclResult[0] as { count?: number } | undefined)?.count ?? 0;

    if (remainingPll > 0 || remainingAcl > 0) {
      console.warn(
        `[Migration 1.0→2.0] ⚠️ ${remainingPll} project_language_link_local and ${remainingAcl} asset_content_link_local records still missing languoid_id`
      );
    }

    console.log('[Migration 1.0→2.0] ✓ languoid_id references populated');
    console.log('[Migration 1.0→2.0] ✓ Migration complete');

    // Note: updateMetadataVersion() is called automatically by the migration system
  }
};
