import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

/**
 * Migration: 2.3 -> 3.0
 *
 * Purpose: Add blueprint system columns to quest_local and asset_local tables.
 * The template_blueprint and project_blueprint_link tables are defined in the
 * Drizzle schema and will be created automatically by PowerSync for synced
 * tables. Local-only tables also get created from the schema. This migration
 * only needs to backfill the new JSON columns into existing local records.
 *
 * New columns on quest_local: blueprint_link_id, blueprint_node_id
 * New columns on asset_local: blueprint_link_id, blueprint_node_id, span_end_blueprint_node_id
 */
export const migration_2_3_to_3_0: Migration = {
  fromVersion: '2.3',
  toVersion: '3.0',
  description:
    'Add blueprint columns to quest and asset for template blueprint system',

  async migrate(db, onProgress) {
    console.log(
      '[Migration 2.3→3.0] Starting blueprint column backfill...'
    );

    const questLocalExists = await rawTableExists(db, 'quest_local');
    const assetLocalExists = await rawTableExists(db, 'asset_local');

    const totalSteps =
      (questLocalExists ? 1 : 0) + (assetLocalExists ? 1 : 0);
    let step = 0;

    if (questLocalExists) {
      step++;
      if (onProgress)
        onProgress(step, totalSteps, 'Adding blueprint columns to quest_local');

      const questTable = getRawTableName('quest_local');
      await db.execute(`
        UPDATE ${questTable}
        SET data = json_set(
          json_set(data, '$.blueprint_link_id', null),
          '$.blueprint_node_id', null
        )
        WHERE json_extract(data, '$.blueprint_link_id') IS NULL
      `);

      console.log(
        '[Migration 2.3→3.0] Added blueprint columns to quest_local'
      );
    }

    if (assetLocalExists) {
      step++;
      if (onProgress)
        onProgress(step, totalSteps, 'Adding blueprint columns to asset_local');

      const assetTable = getRawTableName('asset_local');
      await db.execute(`
        UPDATE ${assetTable}
        SET data = json_set(
          json_set(
            json_set(data, '$.blueprint_link_id', null),
            '$.blueprint_node_id', null
          ),
          '$.span_end_blueprint_node_id', null
        )
        WHERE json_extract(data, '$.blueprint_link_id') IS NULL
      `);

      console.log(
        '[Migration 2.3→3.0] Added blueprint columns to asset_local'
      );
    }

    console.log('[Migration 2.3→3.0] Migration complete');
  }
};
