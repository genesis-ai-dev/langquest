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
      // Extract JSON fields into columns first, then query normally
      const projectLocalTable = getRawTableName('project_local');
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
        INSERT OR IGNORE INTO project_language_link_local (
          id,
          project_id,
          language_id,
          languoid_id,
          language_type,
          active,
          source,
          download_profiles,
          created_at,
          last_updated,
          _metadata
        )
        SELECT 
          p.id || '_target_' || p.target_language_id,
          p.id,
          p.target_language_id,
          p.target_language_id,
          'target',
          1,
          'local',
          p.download_profiles,
          p.created_at,
          p.last_updated,
          p._metadata
        FROM project_data p
        WHERE p.target_language_id IS NOT NULL
          AND p.active = 1
          AND NOT EXISTS (
            SELECT 1 FROM ${projectLocalTable} pll_raw
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
      // Extract JSON fields into columns first, then query normally
      const projectSyncedTable = getRawTableName('project', 'synced');
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
        INSERT OR IGNORE INTO project_language_link_local (
          id,
          project_id,
          language_id,
          languoid_id,
          language_type,
          active,
          source,
          download_profiles,
          created_at,
          last_updated,
          _metadata
        )
        SELECT 
          p.id || '_target_' || p.target_language_id,
          p.id,
          p.target_language_id,
          p.target_language_id,
          'target',
          1,
          'local',
          p.download_profiles,
          p.created_at,
          p.last_updated,
          NULL
        FROM project_data p
        WHERE p.target_language_id IS NOT NULL
          AND p.active = 1
          AND NOT EXISTS (
            SELECT 1 FROM ${getRawTableName('project_language_link')} pll_raw
            WHERE json_extract(pll_raw.data, '$.project_id') = p.id 
              AND json_extract(pll_raw.data, '$.language_type') = 'target'
          )
          AND NOT EXISTS (
            SELECT 1 FROM ${getRawTableName('project_language_link_local')} pll_raw
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

    // Update project_language_link_local with synced languoid if it exists
    // (Server migration creates languoid with id = language_id)
    await db.execute(`
      UPDATE project_language_link_local
      SET languoid_id = (
        SELECT json_extract(data, '$.language_id')
        FROM ${getRawTableName('project_language_link_local')}
        WHERE id = project_language_link_local.id
      )
      WHERE EXISTS (
        SELECT 1 FROM ${getRawTableName('project_language_link_local')} pll_raw
        WHERE pll_raw.id = project_language_link_local.id
          AND json_extract(pll_raw.data, '$.languoid_id') IS NULL
          AND json_extract(pll_raw.data, '$.language_id') IS NOT NULL
      )
        AND EXISTS (
          SELECT 1 FROM languoid 
          WHERE languoid.id = (
            SELECT json_extract(data, '$.language_id')
            FROM ${getRawTableName('project_language_link_local')}
            WHERE id = project_language_link_local.id
          )
        )
    `);

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
        // Update using raw JSON reads - use SQL directly
        // SQLite doesn't support UPDATE...FROM, so we use a correlated subquery
        const aclLocalTable = getRawTableName('asset_content_link_local');
        await db.execute(`
          UPDATE asset_content_link_local
          SET languoid_id = (
            SELECT json_extract(data, '$.source_language_id')
            FROM ${aclLocalTable}
            WHERE id = asset_content_link_local.id
          )
          WHERE languoid_id IS NULL
            AND EXISTS (
              SELECT 1 FROM ${aclLocalTable} acl_raw
              WHERE acl_raw.id = asset_content_link_local.id
                AND json_extract(acl_raw.data, '$.source_language_id') IS NOT NULL
            )
            AND EXISTS (
              SELECT 1 FROM languoid 
              WHERE languoid.id = (
                SELECT json_extract(data, '$.source_language_id')
                FROM ${aclLocalTable}
                WHERE id = asset_content_link_local.id
              )
            )
        `);
      } else {
        // Fallback: use view if JSON key doesn't exist (newer data)
        await db.execute(`
          UPDATE asset_content_link_local
          SET languoid_id = source_language_id
          WHERE languoid_id IS NULL
            AND source_language_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM languoid WHERE languoid.id = asset_content_link_local.source_language_id
            )
        `);
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

    // Create from LOCAL language table first
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
      INSERT OR IGNORE INTO languoid_local (
        id,
        name,
        level,
        ui_ready,
        active,
        source,
        creator_id,
        created_at,
        last_updated,
        _metadata
      )
      SELECT DISTINCT
        l.id,
        COALESCE(l.english_name, l.native_name, 'Unknown'),
        'language',
        COALESCE(l.ui_ready, 0),
        1,
        'local',
        l.creator_id,
        l.created_at,
        l.last_updated,
        l._metadata
      FROM language_data l
      INNER JOIN pll_data pll ON pll.language_id = l.id
      WHERE pll.languoid_id IS NULL
        AND l.active = 1
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
    `
    );

    // Create from SYNCED language table (for downloaded projects where languoid wasn't synced)
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
      INSERT OR IGNORE INTO languoid_local (
        id,
        name,
        level,
        ui_ready,
        active,
        source,
        creator_id,
        created_at,
        last_updated,
        _metadata
      )
      SELECT DISTINCT
        l.id,
        COALESCE(l.english_name, l.native_name, 'Unknown'),
        'language',
        COALESCE(l.ui_ready, 0),
        1,
        'local',
        l.creator_id,
        l.created_at,
        l.last_updated,
        NULL
      FROM language_data l
      INNER JOIN pll_data pll ON pll.language_id = l.id
      WHERE pll.languoid_id IS NULL
        AND l.active = 1
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
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
          INSERT OR IGNORE INTO languoid_local (
            id,
            name,
            level,
            ui_ready,
            active,
            source,
            creator_id,
            created_at,
            last_updated,
            _metadata
          )
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
                'last_updated',
                '_metadata'
              ])}
            FROM ${getRawTableName('language_local')}
          )
          SELECT DISTINCT
            l.id,
            COALESCE(l.english_name, l.native_name, 'Unknown'),
            'language',
            COALESCE(l.ui_ready, 0),
            1,
            'local',
            l.creator_id,
            l.created_at,
            l.last_updated,
            l._metadata
          FROM language_data l
          INNER JOIN acl_data ON acl_data.source_language_id = l.id
          WHERE l.active = 1
            AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
            AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
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
          INSERT OR IGNORE INTO languoid_local (
            id,
            name,
            level,
            ui_ready,
            active,
            source,
            creator_id,
            created_at,
            last_updated,
            _metadata
          )
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
            FROM ${getRawTableName('language')}
          )
          SELECT DISTINCT
            l.id,
            COALESCE(l.english_name, l.native_name, 'Unknown'),
            'language',
            COALESCE(l.ui_ready, 0),
            1,
            'local',
            l.creator_id,
            l.created_at,
            l.last_updated,
            NULL
          FROM language_data l
          INNER JOIN acl_data ON acl_data.source_language_id = l.id
          WHERE l.active = 1
            AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
            AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
        `
        );
      } else {
        // Fallback: use view if JSON key doesn't exist (newer data)
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
          INSERT OR IGNORE INTO languoid_local (
            id,
            name,
            level,
            ui_ready,
            active,
            source,
            creator_id,
            created_at,
            last_updated,
            _metadata
          )
          SELECT DISTINCT
            l.id,
            COALESCE(l.english_name, l.native_name, 'Unknown'),
            'language',
            COALESCE(l.ui_ready, 0),
            1,
            'local',
            l.creator_id,
            l.created_at,
            l.last_updated,
            l._metadata
          FROM language_data l
          INNER JOIN acl_data acl ON acl.source_language_id = l.id
          WHERE acl.languoid_id IS NULL
            AND l.active = 1
            AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
            AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
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
          INSERT OR IGNORE INTO languoid_local (
            id,
            name,
            level,
            ui_ready,
            active,
            source,
            creator_id,
            created_at,
            last_updated,
            _metadata
          )
          SELECT DISTINCT
            l.id,
            COALESCE(l.english_name, l.native_name, 'Unknown'),
            'language',
            COALESCE(l.ui_ready, 0),
            1,
            'local',
            l.creator_id,
            l.created_at,
            l.last_updated,
            NULL
          FROM language_data l
          INNER JOIN acl_data acl ON acl.source_language_id = l.id
          WHERE acl.languoid_id IS NULL
            AND l.active = 1
            AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
            AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
        `
        );
      }
    }

    // FALLBACK: For any remaining language_ids where neither language table has the record
    // (e.g., language was never synced due to sync rules), create a minimal languoid
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
      )
      INSERT OR IGNORE INTO languoid_local (
        id,
        name,
        level,
        ui_ready,
        active,
        source,
        creator_id,
        created_at,
        last_updated,
        _metadata
      )
      SELECT DISTINCT
        pll.language_id,
        'Unknown Language',
        'language',
        0,
        1,
        'local',
        NULL,
        datetime('now'),
        datetime('now'),
        NULL
      FROM pll_data pll
      WHERE pll.languoid_id IS NULL
        AND pll.language_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = pll.language_id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = pll.language_id)
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
          INSERT OR IGNORE INTO languoid_local (
            id,
            name,
            level,
            ui_ready,
            active,
            source,
            creator_id,
            created_at,
            last_updated,
            _metadata
          )
          WITH pll_data AS (
            SELECT 
              ${jsonExtractColumns([
                'id',
                'project_id',
                'language_id',
                'languoid_id'
              ])}
            FROM ${getRawTableName('project_language_link_local')}
          )
          SELECT DISTINCT
            acl_data.source_language_id,
            'Unknown Language',
            'language',
            0,
            1,
            'local',
            NULL,
            datetime('now'),
            datetime('now'),
            NULL
          FROM acl_data
          INNER JOIN pll_data pll ON 
            pll.language_id = acl_data.source_language_id
          WHERE pll.languoid_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM languoid 
              WHERE languoid.id = acl_data.source_language_id
            )
            AND NOT EXISTS (
              SELECT 1 FROM languoid_local 
              WHERE languoid_local.id = acl_data.source_language_id
            )
        `
        );
      } else {
        // Fallback: use view if JSON key doesn't exist
        await db.execute(
          `
          WITH acl_data AS (
            SELECT 
              ${jsonExtractColumns(['id', 'source_language_id', 'languoid_id'])}
            FROM ${getRawTableName('asset_content_link_local')}
          )
          INSERT OR IGNORE INTO languoid_local (
            id,
            name,
            level,
            ui_ready,
            active,
            source,
            creator_id,
            created_at,
            last_updated,
            _metadata
          )
          SELECT DISTINCT
            acl.source_language_id,
            'Unknown Language',
            'language',
            0,
            1,
            'local',
            NULL,
            datetime('now'),
            datetime('now'),
            NULL
          FROM acl_data acl
          WHERE acl.languoid_id IS NULL
            AND acl.source_language_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = acl.source_language_id)
            AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = acl.source_language_id)
        `
        );
      }
    }

    console.log('[Migration 1.0→2.0] ✓ languoid_local records created');

    // Step 4: Populate languoid_id references for all remaining records
    if (onProgress) onProgress(4, 4, 'Populating languoid_id references');
    console.log('[Migration 1.0→2.0] Populating languoid_id references...');

    // Update project_language_link_local.languoid_id - check both synced and local languoids
    await db.execute(
      `
      UPDATE project_language_link_local
      SET languoid_id = (
        SELECT json_extract(data, '$.language_id')
        FROM ${getRawTableName('project_language_link_local')}
        WHERE id = project_language_link_local.id
      )
      WHERE languoid_id IS NULL
        AND EXISTS (
          SELECT 1 FROM ${getRawTableName('project_language_link_local')} pll_raw
          WHERE pll_raw.id = project_language_link_local.id
            AND json_extract(pll_raw.data, '$.language_id') IS NOT NULL
        )
        AND (
          EXISTS (
            SELECT 1 FROM languoid 
            WHERE languoid.id = (
              SELECT json_extract(data, '$.language_id')
              FROM ${getRawTableName('project_language_link_local')}
              WHERE id = project_language_link_local.id
            )
          )
          OR EXISTS (
            SELECT 1 FROM languoid_local 
            WHERE languoid_local.id = (
              SELECT json_extract(data, '$.language_id')
              FROM ${getRawTableName('project_language_link_local')}
              WHERE id = project_language_link_local.id
            )
          )
        )
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
        // Update languoid_id from raw JSON using SQL directly
        // SQLite doesn't support UPDATE...FROM, so we use a correlated subquery
        const aclLocalTable = getRawTableName('asset_content_link_local');
        await db.execute(
          `
          UPDATE asset_content_link_local
          SET languoid_id = (
            SELECT json_extract(data, '$.source_language_id')
            FROM ${aclLocalTable}
            WHERE id = asset_content_link_local.id
          )
          WHERE languoid_id IS NULL
            AND EXISTS (
              SELECT 1 FROM ${aclLocalTable} acl_raw
              WHERE acl_raw.id = asset_content_link_local.id
                AND json_extract(acl_raw.data, '$.source_language_id') IS NOT NULL
            )
            AND (
              EXISTS (
                SELECT 1 FROM languoid 
                WHERE languoid.id = (
                  SELECT json_extract(data, '$.source_language_id')
                  FROM ${aclLocalTable}
                  WHERE id = asset_content_link_local.id
                )
              )
              OR EXISTS (
                SELECT 1 FROM languoid_local 
                WHERE languoid_local.id = (
                  SELECT json_extract(data, '$.source_language_id')
                  FROM ${aclLocalTable}
                  WHERE id = asset_content_link_local.id
                )
              )
            )
        `
        );
      } else {
        // Fallback: use view if JSON key doesn't exist
        await db.execute(
          `
          UPDATE asset_content_link_local
          SET languoid_id = (
            SELECT json_extract(data, '$.source_language_id')
            FROM ${getRawTableName('asset_content_link_local')}
            WHERE id = asset_content_link_local.id
          )
          WHERE languoid_id IS NULL
            AND EXISTS (
              SELECT 1 FROM ${getRawTableName('asset_content_link_local')} acl_raw
              WHERE acl_raw.id = asset_content_link_local.id
                AND json_extract(acl_raw.data, '$.source_language_id') IS NOT NULL
            )
            AND (
              EXISTS (
                SELECT 1 FROM languoid 
                WHERE languoid.id = (
                  SELECT json_extract(data, '$.source_language_id')
                  FROM ${getRawTableName('asset_content_link_local')}
                  WHERE id = asset_content_link_local.id
                )
              )
              OR EXISTS (
                SELECT 1 FROM languoid_local 
                WHERE languoid_local.id = (
                  SELECT json_extract(data, '$.source_language_id')
                  FROM ${getRawTableName('asset_content_link_local')}
                  WHERE id = asset_content_link_local.id
                )
              )
            )
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
    const remainingPll = (remainingPllResult[0] as { count?: number }) || null;

    const remainingAclResult = await db.getAll(
      `
      SELECT COUNT(*) as count FROM ${getRawTableName('asset_content_link_local')}
      WHERE json_extract(data, '$.languoid_id') IS NULL 
        AND json_extract(data, '$.source_language_id') IS NOT NULL
    `
    );
    const remainingAcl = (remainingAclResult[0] as { count?: number }) || null;

    if (remainingPll?.count || remainingAcl?.count) {
      console.warn(
        `[Migration 1.0→2.0] ⚠️ ${remainingPll?.count || 0} project_language_link_local and ${remainingAcl?.count || 0} asset_content_link_local records still missing languoid_id`
      );
    }

    console.log('[Migration 1.0→2.0] ✓ languoid_id references populated');
    console.log('[Migration 1.0→2.0] ✓ Migration complete');

    // Note: updateMetadataVersion() is called automatically by the migration system
  }
};
