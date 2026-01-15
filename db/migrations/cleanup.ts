/**
 * Utility to clean up duplicate languoid records after migration
 *
 * This handles the case where migration 1.0→2.0 created local languoids
 * that later get synced from Supabase. When the same languoid exists in both
 * local table and Supabase cloud, we:
 * 1. Query Supabase directly to check for remote languoids
 * 2. Relink all references from local languoid to the remote languoid ID
 * 3. Delete the local languoid duplicate
 *
 * Tables that reference languoid_id:
 * - project_language_link_local.languoid_id
 * - asset_content_link_local.languoid_id
 * - profile_local.ui_languoid_id (if any)
 *
 * Usage: Import and call `migrationCleanup()` after PowerSync initialization
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { eq, sql } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import { getRawTableName } from './utils';

interface DuplicateLanguoid {
  id: string;
  name: string | null;
  source: 'local' | 'synced';
}

/**
 * Get local languoids with awaiting_cleanup flag
 * Queries Supabase directly for remote languoids instead of checking synced table
 */
async function getLanguoidTablesAndRecords() {
  const languoidLocal = resolveTable('languoid', { localOverride: true });

  // Reusable filter condition for awaiting_cleanup languoids
  const awaitingCleanupFilter = sql`json_extract(${languoidLocal._metadata}, '$.awaiting_cleanup') = 1`;

  // Get local languoids with awaiting_cleanup flag
  const localLanguoids = await system.db
    .select()
    .from(languoidLocal)
    .where(awaitingCleanupFilter);

  return { languoidLocal, localLanguoids };
}

/**
 * Remove awaiting_cleanup flag from a languoid's metadata
 * Works with either a transaction or regular database instance
 */
async function removeAwaitingCleanupFlag(
  languoidLocal: ReturnType<typeof resolveTable<'languoid'>>,
  localId: string,
  localLanguoid:
    | { _metadata?: { awaiting_cleanup?: boolean } | null }
    | undefined,
  dbOrTx:
    | typeof system.db
    | Parameters<Parameters<typeof system.db.transaction>[0]>[0]
): Promise<void> {
  if (
    localLanguoid?._metadata &&
    'awaiting_cleanup' in localLanguoid._metadata
  ) {
    const { awaiting_cleanup: _, ...metadataWithoutFlag } =
      localLanguoid._metadata;
    await dbOrTx
      .update(languoidLocal)
      .set({ _metadata: metadataWithoutFlag })
      .where(eq(languoidLocal.id, localId));
  }
}

/**
 * Find and remove duplicate languoid records
 * Relinks all references from local languoid to Supabase languoid, then deletes local duplicate
 * Matches by ID - queries Supabase directly to check for languoids that exist remotely
 */
export async function cleanupDuplicateLanguoids(): Promise<{
  cleanedCount: number;
  duplicates: DuplicateLanguoid[];
}> {
  console.log('🧹 [LanguoidCleanup] Scanning for duplicate languoids...');

  // Get languoids with awaiting_cleanup flag (filtered in SQL)
  const { languoidLocal, localLanguoids } = await getLanguoidTablesAndRecords();

  const awaitingCleanupLanguoids = localLanguoids;

  // Early return if no migration-created languoids exist (nothing to clean up)
  if (awaitingCleanupLanguoids.length === 0) {
    console.log(
      '✅ [LanguoidCleanup] No migration-created languoids found - nothing to clean up'
    );
    return { cleanedCount: 0, duplicates: [] };
  }

  /**
   * Check if languoids exist remotely in Supabase
   * Returns a set of IDs that exist remotely
   */
  const findRemoteLanguoidIds = async (
    localLanguoidIds: string[]
  ): Promise<Set<string>> => {
    const remoteIds = new Set<string>();

    try {
      // Filter out non-UUID IDs (e.g., test IDs like "test-language-1")
      // Supabase expects valid UUIDs for the .in() filter
      const validUuidIds = localLanguoidIds.filter((id) => uuid.validate(id));

      if (validUuidIds.length === 0) {
        console.log(
          `ℹ️ [LanguoidCleanup] No valid UUID languoid IDs to check (all ${localLanguoidIds.length} are test/invalid IDs)`
        );
        return remoteIds;
      }

      const skippedCount = localLanguoidIds.length - validUuidIds.length;
      if (skippedCount > 0) {
        const skippedIds = localLanguoidIds.filter((id) => !uuid.validate(id));
        console.log(
          `ℹ️ [LanguoidCleanup] Removing awaiting_cleanup flag from ${skippedCount} non-UUID languoid ID(s) (test data): ${skippedIds.join(', ')}`
        );

        // Remove awaiting_cleanup flag from non-valid UUID languoids (test data) in a single query
        try {
          const languoidRawTable = getRawTableName('languoid_local', 'local');
          // Build query with IN clause for all skipped IDs
          const idsList = skippedIds
            .map((id) => `'${id.replace(/'/g, "''")}'`)
            .join(',');
          const query = `
            UPDATE ${languoidRawTable}
            SET data = json_set(
              json_remove(data, '$._metadata.awaiting_cleanup'),
              '$._metadata.schema_version',
              COALESCE(json_extract(data, '$._metadata.schema_version'), '2.0')
            )
            WHERE id IN (${idsList})
              AND json_extract(json(json_extract(data, '$._metadata')), '$.awaiting_cleanup') = 1
          `;
          await system.powersync.execute(query);
          console.log(
            `  ✓ Removed awaiting_cleanup flag from ${skippedCount} test languoid(s)`
          );
        } catch (error) {
          console.warn(
            `  ⚠️ Failed to remove awaiting_cleanup flag from test languoids:`,
            error
          );
        }
      }

      console.log(
        `🔍 [LanguoidCleanup] Checking ${validUuidIds.length} languoid(s) against Supabase: ${validUuidIds.join(', ')}`
      );

      // Query Supabase directly to check if any languoids with matching IDs exist remotely
      const { data: remoteLanguoids, error } =
        await system.supabaseConnector.client
          .from('languoid')
          .select('id, name')
          .in('id', validUuidIds)
          .eq('active', true)
          .overrideTypes<{ id: string; name: string | null }[]>();

      if (!error && remoteLanguoids.length > 0) {
        console.log(
          `ℹ️ [LanguoidCleanup] Found ${remoteLanguoids.length} languoid(s) in Supabase`
        );

        // Add Supabase matches to remote IDs set
        remoteLanguoids.forEach((remoteLanguoid) => {
          remoteIds.add(remoteLanguoid.id);
          console.log(
            `  - ${remoteLanguoid.id}: "${remoteLanguoid.name}" (exists in Supabase)`
          );
        });
      } else if (error) {
        console.warn(
          `⚠️ [LanguoidCleanup] Failed to query Supabase for remote languoids:`,
          error
        );
      } else {
        console.log(
          `ℹ️ [LanguoidCleanup] No matching languoids found in Supabase`
        );
      }
    } catch (error) {
      console.warn(
        `⚠️ [LanguoidCleanup] Error checking Supabase (non-critical):`,
        error
      );
      // Don't throw - offline or network errors shouldn't block cleanup
    }

    return remoteIds;
  };

  // Find duplicates: languoids that exist remotely in Supabase
  const localLanguoidIds = awaitingCleanupLanguoids.map((l) => l.id);
  const remoteIds = await findRemoteLanguoidIds(localLanguoidIds);

  // Build duplicates list from languoids that exist remotely
  const duplicates: DuplicateLanguoid[] = [];
  const nonDuplicateIds: string[] = [];
  awaitingCleanupLanguoids.forEach((localLanguoid) => {
    if (remoteIds.has(localLanguoid.id)) {
      duplicates.push({
        id: localLanguoid.id,
        name: localLanguoid.name,
        source: 'local'
      });
    } else {
      // Languoid doesn't exist in Supabase - still need to remove awaiting_cleanup flag
      nonDuplicateIds.push(localLanguoid.id);
    }
  });

  // Remove awaiting_cleanup flag from languoids that don't exist in Supabase
  if (nonDuplicateIds.length > 0) {
    console.log(
      `ℹ️ [LanguoidCleanup] Removing awaiting_cleanup flag from ${nonDuplicateIds.length} languoid(s) not found in Supabase`
    );
    try {
      for (const localId of nonDuplicateIds) {
        const localLanguoid = awaitingCleanupLanguoids.find(
          (l) => l.id === localId
        );
        await removeAwaitingCleanupFlag(
          languoidLocal,
          localId,
          localLanguoid,
          system.db
        );
        console.log(`  ✓ Removed awaiting_cleanup flag from: ${localId}`);
      }
    } catch (error) {
      console.warn(
        `⚠️ [LanguoidCleanup] Failed to remove awaiting_cleanup flag from non-duplicate languoids:`,
        error
      );
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ [LanguoidCleanup] No duplicate languoids found');
    return { cleanedCount: 0, duplicates: [] };
  }

  console.log(
    `🔍 [LanguoidCleanup] Found ${duplicates.length} duplicate languoid(s):`
  );
  duplicates.forEach((dup) => {
    console.log(`  - ${dup.id}: "${dup.name}"`);
  });

  let totalCleaned = 0;

  // Process each duplicate in a transaction to ensure atomicity
  for (const duplicate of duplicates) {
    const localId = duplicate.id;
    const syncedId = duplicate.id; // Same ID, different tables

    console.log(
      `🔄 [LanguoidCleanup] Relinking references for languoid: ${localId}`
    );

    try {
      await system.db.transaction(async (tx) => {
        // 0. Remove awaiting_cleanup flag from metadata at the start of transaction
        const localLanguoid = awaitingCleanupLanguoids.find(
          (l) => l.id === localId
        );
        await removeAwaitingCleanupFlag(
          languoidLocal,
          localId,
          localLanguoid,
          tx
        );

        // 1. Update project_language_link_local references
        const projectLanguageLinkLocal = resolveTable('project_language_link', {
          localOverride: true
        });
        await tx
          .update(projectLanguageLinkLocal)
          .set({ languoid_id: syncedId })
          .where(eq(projectLanguageLinkLocal.languoid_id, localId));

        // 2. Update asset_content_link_local references
        const assetContentLinkLocal = resolveTable('asset_content_link', {
          localOverride: true
        });
        await tx
          .update(assetContentLinkLocal)
          .set({ languoid_id: syncedId })
          .where(eq(assetContentLinkLocal.languoid_id, localId));

        // 3. Update profile_local.ui_languoid_id references (if any)
        const profileLocal = resolveTable('profile', { localOverride: true });
        await tx
          .update(profileLocal)
          .set({ ui_languoid_id: syncedId })
          .where(eq(profileLocal.ui_languoid_id, localId));

        // 4. Delete the local languoid duplicate
        await tx.delete(languoidLocal).where(eq(languoidLocal.id, localId));
      });

      console.log(
        `  ✓ Relinked references and deleted local languoid: ${localId}`
      );
      totalCleaned++;
    } catch (error) {
      console.error(
        `  ✗ Failed to relink references for languoid ${localId}:`,
        error
      );
      // Continue with next duplicate - don't throw to allow other duplicates to be processed
    }
  }

  console.log(
    `✅ [LanguoidCleanup] Cleaned up ${totalCleaned} duplicate languoid record(s)`
  );

  return {
    cleanedCount: totalCleaned,
    duplicates
  };
}

/**
 * Run cleanup immediately if PowerSync is initialized and internet is available
 * Otherwise, register callback to run after PowerSync sync completes
 * This handles duplicate languoids created during migration that later get synced
 * Only runs if there are actually languoids with awaiting_cleanup flag
 */
export async function migrationCleanup(): Promise<void> {
  // Check if there are any languoids with awaiting_cleanup flag (filtered in SQL)
  let awaitingCleanupCount = 0;
  try {
    const { localLanguoids } = await getLanguoidTablesAndRecords();
    awaitingCleanupCount = localLanguoids.length;
  } catch (error) {
    // If query fails, assume no languoids need cleanup (non-critical)
    console.warn(
      '[MigrationCleanup] Could not check for awaiting_cleanup languoids (non-critical):',
      error
    );
    return;
  }

  if (awaitingCleanupCount === 0) {
    console.log(
      '[MigrationCleanup] No languoids with awaiting_cleanup flag found - skipping cleanup'
    );
    return;
  }

  // Check if PowerSync is initialized and internet is available
  const { system } = await import('@/db/powersync/system');
  const { useNetworkStore } = await import('@/store/networkStore');

  const isPowerSyncReady = system.isPowerSyncInitialized();
  const isOnline = useNetworkStore.getState().isConnected;

  if (isPowerSyncReady && isOnline) {
    // PowerSync is ready and internet is available - run cleanup immediately
    console.log(
      `[MigrationCleanup] PowerSync initialized and online - running cleanup immediately (${awaitingCleanupCount} languoid(s) awaiting cleanup)`
    );
    try {
      const cleanupResult = await cleanupDuplicateLanguoids();
      console.log(
        `[MigrationCleanup] ✓ Languoid cleanup completed: ${cleanupResult.cleanedCount} duplicate(s) removed`
      );
    } catch (error) {
      console.error(
        '[MigrationCleanup] ⚠️ Languoid cleanup failed (non-critical):',
        error
      );
      // Don't throw - cleanup failure shouldn't block the app
    }
  } else {
    // PowerSync not ready or offline - register callback to run after sync completes
    const reason = !isPowerSyncReady ? 'PowerSync not initialized' : 'offline';
    console.log(
      `[MigrationCleanup] ${reason} - registering cleanup callback for next sync (${awaitingCleanupCount} languoid(s) awaiting cleanup)`
    );

    const { syncCallbackService } = await import(
      '@/services/syncCallbackService'
    );

    syncCallbackService.registerCallback(
      'languoid-migration-cleanup',
      async () => {
        console.log(
          '[MigrationCleanup] Running post-migration languoid cleanup after sync...'
        );
        try {
          const cleanupResult = await cleanupDuplicateLanguoids();
          console.log(
            `[MigrationCleanup] ✓ Languoid cleanup completed: ${cleanupResult.cleanedCount} duplicate(s) removed`
          );
        } catch (error) {
          console.error(
            '[MigrationCleanup] ⚠️ Languoid cleanup failed (non-critical):',
            error
          );
          // Don't throw - cleanup failure shouldn't block the app
        }
      }
    );
  }
}
