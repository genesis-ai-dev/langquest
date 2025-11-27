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
 * 1. Add ui_languoid_id column to profile_local
 * 2. Add languoid_id column to asset_content_link_local
 * 3. Add languoid_id column to project_language_link_local (REQUIRED - new PK)
 * 4. Create languoid_local records from language_local for offline projects
 * 5. Populate languoid_id in project_language_link_local
 *
 * NOTE: New languoid/region tables are created automatically by the schema.
 * This migration only handles data transformation for existing records.
 */

import { sql } from 'drizzle-orm';
import type { Migration } from './index';
import { addColumn, columnExists } from './utils';

export const migration_1_0_to_2_0: Migration = {
  fromVersion: '1.0',
  toVersion: '2.0',
  description: 'Add languoid support for offline projects (breaking change)',

  async migrate(db, onProgress) {
    console.log('[Migration 1.0→2.0] Starting languoid migration...');

    // Step 1: Add ui_languoid_id column to profile_local
    if (onProgress) onProgress(1, 5, 'Adding ui_languoid_id to profile_local');
    console.log('[Migration 1.0→2.0] Adding ui_languoid_id to profile_local...');

    if (!(await columnExists(db, 'profile_local', 'ui_languoid_id'))) {
      await addColumn(db, 'profile_local', 'ui_languoid_id TEXT DEFAULT NULL');
    }
    console.log('[Migration 1.0→2.0] ✓ profile_local.ui_languoid_id added');

    // Step 2: Add languoid_id column to asset_content_link_local
    if (onProgress)
      onProgress(2, 5, 'Adding languoid_id to asset_content_link_local');
    console.log(
      '[Migration 1.0→2.0] Adding languoid_id to asset_content_link_local...'
    );

    if (!(await columnExists(db, 'asset_content_link_local', 'languoid_id'))) {
      await addColumn(
        db,
        'asset_content_link_local',
        'languoid_id TEXT DEFAULT NULL'
      );
    }
    console.log(
      '[Migration 1.0→2.0] ✓ asset_content_link_local.languoid_id added'
    );

    // Step 3: Add languoid_id column to project_language_link_local
    // This is required because it's part of the new primary key
    if (onProgress)
      onProgress(3, 5, 'Adding languoid_id to project_language_link_local');
    console.log(
      '[Migration 1.0→2.0] Adding languoid_id to project_language_link_local...'
    );

    if (
      !(await columnExists(db, 'project_language_link_local', 'languoid_id'))
    ) {
      await addColumn(
        db,
        'project_language_link_local',
        'languoid_id TEXT DEFAULT NULL'
      );
    }
    console.log(
      '[Migration 1.0→2.0] ✓ project_language_link_local.languoid_id added'
    );

    // Step 4: Create languoid_local records from language_local
    // For offline projects, we need to create languoid records for any languages
    // that are referenced by project_language_link_local but don't have languoids yet.
    // We use language_id as the languoid_id (matching server migration pattern).
    if (onProgress)
      onProgress(4, 5, 'Creating languoid records for offline languages');
    console.log(
      '[Migration 1.0→2.0] Creating languoid_local from language_local...'
    );

    // Find all language_ids referenced in project_language_link_local that need languoids
    // Insert into languoid_local using language_id as the id (matching server pattern)
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
    `);

    // Also create languoid records for languages in asset_content_link_local
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
    `);

    console.log('[Migration 1.0→2.0] ✓ languoid_local records created');

    // Step 5: Populate languoid_id in project_language_link_local and asset_content_link_local
    if (onProgress) onProgress(5, 5, 'Populating languoid_id references');
    console.log('[Migration 1.0→2.0] Populating languoid_id references...');

    // Update project_language_link_local.languoid_id to match language_id
    // This works because we created languoids with id = language_id
    await db.run(sql`
      UPDATE project_language_link_local
      SET languoid_id = language_id
      WHERE languoid_id IS NULL
        AND language_id IS NOT NULL
    `);

    // Update asset_content_link_local.languoid_id to match source_language_id
    await db.run(sql`
      UPDATE asset_content_link_local
      SET languoid_id = source_language_id
      WHERE languoid_id IS NULL
        AND source_language_id IS NOT NULL
    `);

    console.log('[Migration 1.0→2.0] ✓ languoid_id references populated');
    console.log('[Migration 1.0→2.0] ✓ Migration complete');

    // Note: updateMetadataVersion() is called automatically by the migration system
  }
};

