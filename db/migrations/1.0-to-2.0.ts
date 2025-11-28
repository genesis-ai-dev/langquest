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
 * NOTE: The languoid_id and ui_languoid_id columns are already defined in the Drizzle schema.
 * PowerSync creates tables with all schema-defined columns automatically.
 * DO NOT use addColumn() for schema-defined columns - it corrupts raw PowerSync tables.
 * This migration only handles DATA transformation for existing records.
 */

import { sql } from 'drizzle-orm';
import type { Migration } from './index';

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

    // Step 1: Create project_language_link_local records from project_local.target_language_id
    // This handles old projects created before project_language_link existed
    // These projects have target_language_id on the project table but no link record
    if (onProgress)
      onProgress(1, 4, 'Creating missing project_language_link records');
    console.log(
      '[Migration 1.0→2.0] Creating project_language_link_local from project_local.target_language_id...'
    );

    // Create project_language_link_local records for local projects that have target_language_id
    // but don't have a corresponding link record yet
    await db.run(sql`
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
      FROM project_local p
      WHERE p.target_language_id IS NOT NULL
        AND p.active = 1
        AND NOT EXISTS (
          SELECT 1 FROM project_language_link_local pll 
          WHERE pll.project_id = p.id AND pll.language_type = 'target'
        )
    `);

    // Also check synced project table for projects that might be synced but missing link records
    // This can happen if the project was synced before the server migration ran
    await db.run(sql`
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
      FROM project p
      WHERE p.target_language_id IS NOT NULL
        AND p.active = 1
        AND NOT EXISTS (
          SELECT 1 FROM project_language_link pll 
          WHERE pll.project_id = p.id AND pll.language_type = 'target'
        )
        AND NOT EXISTS (
          SELECT 1 FROM project_language_link_local pll 
          WHERE pll.project_id = p.id AND pll.language_type = 'target'
        )
    `);

    console.log('[Migration 1.0→2.0] ✓ project_language_link_local records created');

    // Step 2: Try to use existing synced languoids if they match the language_id
    // The server migration uses language_id as the languoid_id, so check if that languoid exists
    if (onProgress)
      onProgress(2, 4, 'Checking for existing synced languoids');
    console.log(
      '[Migration 1.0→2.0] Checking for existing synced languoids...'
    );

    // Update project_language_link_local with synced languoid if it exists
    // (Server migration creates languoid with id = language_id)
    await db.run(sql`
      UPDATE project_language_link_local
      SET languoid_id = language_id
      WHERE languoid_id IS NULL
        AND language_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM languoid WHERE languoid.id = project_language_link_local.language_id
        )
    `);

    // Same for asset_content_link_local
    await db.run(sql`
      UPDATE asset_content_link_local
      SET languoid_id = source_language_id
      WHERE languoid_id IS NULL
        AND source_language_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM languoid WHERE languoid.id = asset_content_link_local.source_language_id
        )
    `);

    console.log('[Migration 1.0→2.0] ✓ Synced languoid references applied');

    // Step 3: Create languoid_local records for any remaining language references
    // Check BOTH synced and local language tables, and create languoid_local if missing
    if (onProgress)
      onProgress(3, 4, 'Creating languoid records for unmatched languages');
    console.log(
      '[Migration 1.0→2.0] Creating languoid_local for unmatched languages...'
    );

    // Create from LOCAL language table first
    await db.run(sql`
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
      FROM language_local l
      INNER JOIN project_language_link_local pll ON pll.language_id = l.id
      WHERE pll.languoid_id IS NULL
        AND l.active = 1
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
    `);

    // Create from SYNCED language table (for downloaded projects where languoid wasn't synced)
    await db.run(sql`
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
      FROM language l
      INNER JOIN project_language_link_local pll ON pll.language_id = l.id
      WHERE pll.languoid_id IS NULL
        AND l.active = 1
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
    `);

    // Handle asset_content_link_local - from local language
    await db.run(sql`
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
      FROM language_local l
      INNER JOIN asset_content_link_local acl ON acl.source_language_id = l.id
      WHERE acl.languoid_id IS NULL
        AND l.active = 1
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
    `);

    // Handle asset_content_link_local - from synced language
    await db.run(sql`
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
      FROM language l
      INNER JOIN asset_content_link_local acl ON acl.source_language_id = l.id
      WHERE acl.languoid_id IS NULL
        AND l.active = 1
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = l.id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = l.id)
    `);

    // FALLBACK: For any remaining language_ids where neither language table has the record
    // (e.g., language was never synced due to sync rules), create a minimal languoid
    await db.run(sql`
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
      FROM project_language_link_local pll
      WHERE pll.languoid_id IS NULL
        AND pll.language_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = pll.language_id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = pll.language_id)
    `);

    await db.run(sql`
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
      FROM asset_content_link_local acl
      WHERE acl.languoid_id IS NULL
        AND acl.source_language_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM languoid WHERE languoid.id = acl.source_language_id)
        AND NOT EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = acl.source_language_id)
    `);

    console.log('[Migration 1.0→2.0] ✓ languoid_local records created');

    // Step 4: Populate languoid_id references for all remaining records
    if (onProgress) onProgress(4, 4, 'Populating languoid_id references');
    console.log('[Migration 1.0→2.0] Populating languoid_id references...');

    // Update project_language_link_local.languoid_id - check both synced and local languoids
    await db.run(sql`
      UPDATE project_language_link_local
      SET languoid_id = language_id
      WHERE languoid_id IS NULL
        AND language_id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM languoid WHERE languoid.id = project_language_link_local.language_id)
          OR EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = project_language_link_local.language_id)
        )
    `);

    // Update asset_content_link_local.languoid_id - check both synced and local languoids
    await db.run(sql`
      UPDATE asset_content_link_local
      SET languoid_id = source_language_id
      WHERE languoid_id IS NULL
        AND source_language_id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM languoid WHERE languoid.id = asset_content_link_local.source_language_id)
          OR EXISTS (SELECT 1 FROM languoid_local WHERE languoid_local.id = asset_content_link_local.source_language_id)
        )
    `);

    // Log any remaining records without languoid_id for debugging
    const remainingPll = (await db.get(sql`
      SELECT COUNT(*) as count FROM project_language_link_local 
      WHERE languoid_id IS NULL AND language_id IS NOT NULL
    `)) as { count: number } | undefined;

    const remainingAcl = (await db.get(sql`
      SELECT COUNT(*) as count FROM asset_content_link_local 
      WHERE languoid_id IS NULL AND source_language_id IS NOT NULL
    `)) as { count: number } | undefined;

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
