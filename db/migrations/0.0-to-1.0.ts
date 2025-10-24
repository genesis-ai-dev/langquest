/**
 * Migration: 0.0 → 1.0
 *
 * This migration handles data that was created before the versioning system existed.
 * Records at version 0.0 have NULL or missing _metadata.schema_version fields.
 *
 * Purpose: Stamp all existing unversioned data with version 1.0
 * 
 * Note: If your schema has changed since version 0.0, add the necessary
 * transformations here (add columns, transform data, etc.)
 */

import type { Migration } from './index';

export const migration_0_0_to_1_0: Migration = {
    fromVersion: '0.0',
    toVersion: '1.0',
    description: 'Initialize versioning system for existing data',

    async migrate(db, onProgress) {
        console.log('[Migration 0.0→1.0] Starting migration...');

        // This migration primarily exists to stamp existing unversioned data
        // with the version 1.0 _metadata field
        
        if (onProgress) onProgress(1, 1, 'Stamping existing data with version');

        // If you need to make schema changes to bring 0.0 data to 1.0 format,
        // add them here. For example:
        //
        // await addColumn(db, 'ps_data_local__asset_local', 'new_field TEXT DEFAULT NULL');
        //
        // Remember to use the PowerSync table names with ps_data_local__ prefix!

        console.log('[Migration 0.0→1.0] ✓ Migration complete');

        // Note: updateMetadataVersion() is called automatically by the migration system
        // It will stamp all records in *_local tables with version 1.0
    }
};

