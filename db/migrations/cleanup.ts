/**
 * Utility to clean up duplicate languoid records after migration
 *
 * This handles the case where migration 1.0→2.0 created local languoids
 * that later get synced from Supabase. When the same languoid exists in both
 * local and synced tables, we:
 * 1. Relink all references from local languoid to synced languoid
 * 2. Delete the local languoid duplicate
 *
 * Tables that reference languoid_id:
 * - project_language_link_local.languoid_id
 * - asset_content_link_local.languoid_id
 * - profile_local.ui_languoid_id (if any)
 *
 * Usage: Import and call `migrationCleanup()` after migrations complete
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { eq } from 'drizzle-orm';

interface DuplicateLanguoid {
  id: string;
  name: string | null;
  source: 'local' | 'synced';
}

/**
 * Find and remove duplicate languoid records
 * Relinks all references from local languoid to synced languoid, then deletes local duplicate
 * Also checks Supabase for languoids that exist remotely but aren't synced locally
 */
export async function cleanupDuplicateLanguoids(): Promise<{
  cleanedCount: number;
  duplicates: DuplicateLanguoid[];
  remoteOnly: number; // Count of languoids that exist remotely but aren't synced locally
}> {
  console.log('🧹 [LanguoidCleanup] Scanning for duplicate languoids...');

  const languoidLocal = resolveTable('languoid', { localOverride: true });
  const languoidSynced = resolveTable('languoid', { localOverride: false });

  // Get all languoids from both tables
  const [localLanguoids, syncedLanguoids] = await Promise.all([
    system.db.select().from(languoidLocal),
    system.db.select().from(languoidSynced)
  ]);

  // Filter to only languoids marked with awaiting_cleanup flag (created during migration)
  const awaitingCleanupLanguoids = localLanguoids.filter(
    (l) => l._metadata?.awaiting_cleanup === true
  );

  // Early return if no migration-created languoids exist (nothing to clean up)
  if (awaitingCleanupLanguoids.length === 0) {
    console.log(
      '✅ [LanguoidCleanup] No migration-created languoids found - nothing to clean up'
    );
    return { cleanedCount: 0, duplicates: [], remoteOnly: 0 };
  }

  // Create maps for quick lookup
  const syncedMap = new Map(syncedLanguoids.map((l) => [l.id, l]));

  // Find duplicates: languoids that exist in both local and synced tables
  // Only check migration-created languoids
  const duplicates: DuplicateLanguoid[] = [];
  awaitingCleanupLanguoids.forEach((localLanguoid) => {
    if (syncedMap.has(localLanguoid.id)) {
      duplicates.push({
        id: localLanguoid.id,
        name: localLanguoid.name,
        source: 'local'
      });
    }
  });

  // Check Supabase for languoids that exist remotely but aren't synced locally
  // Only check languoids marked with awaiting_cleanup flag (created during migration)
  // Match by name since migration-created languoids may have different IDs than Supabase
  let remoteOnlyCount = 0;

  if (awaitingCleanupLanguoids.length > 0) {
    try {
      console.log(
        `🔍 [LanguoidCleanup] Checking ${awaitingCleanupLanguoids.length} migration-created languoid(s) against Supabase...`
      );

      // Get unique names from migration-created languoids
      const languoidNames = [
        ...new Set(
          awaitingCleanupLanguoids
            .map((l) => l.name)
            .filter(
              (name): name is string => name !== null && name !== 'Unknown'
            )
        )
      ];

      if (languoidNames.length > 0) {
        // Query Supabase to check if any languoids with matching names exist remotely
        const { data: remoteLanguoids, error } =
          await system.supabaseConnector.client
            .from('languoid')
            .select('id, name')
            .in('name', languoidNames)
            .eq('active', true)
            .overrideTypes<{ id: string; name: string | null }[]>();

        // Track which languoids had matches (by name) in Supabase
        const matchedRemoteNames = new Set<string>();
        if (!error) {
          remoteLanguoids?.forEach((r) => {
            const nameLower = r.name?.toLowerCase().trim();
            if (nameLower) {
              matchedRemoteNames.add(nameLower);
            }
          });

          if (remoteLanguoids.length > 0) {
            remoteOnlyCount = remoteLanguoids.length;
            console.log(
              `ℹ️ [LanguoidCleanup] Found ${remoteOnlyCount} languoid(s) by name that exist remotely but aren't synced locally`
            );
            console.log(
              `   These languoids may not be synced due to sync rules (e.g., not ui_ready or not in download_profiles)`
            );
            console.log(
              `   Keeping local copies since they can't be referenced if not synced locally`
            );
          }
        } else if (error) {
          console.warn(
            `⚠️ [LanguoidCleanup] Failed to query Supabase for remote languoids:`,
            error
          );
        }

        // Remove awaiting_cleanup flag from languoids that:
        // 1. Are not duplicates (not being deleted)
        // 2. Were not found in Supabase (no remote match)
        const languoidsToCleanFlag = awaitingCleanupLanguoids.filter((l) => {
          // Skip if this languoid is a duplicate (will be deleted)
          if (duplicates.some((dup) => dup.id === l.id)) {
            return false;
          }

          // Skip if this languoid was found in Supabase (keep flag for future checks)
          const nameLower = l.name?.toLowerCase().trim();
          if (nameLower && matchedRemoteNames.has(nameLower)) {
            return false;
          }

          // This languoid has no matches - remove the flag
          return true;
        });

        if (languoidsToCleanFlag.length > 0) {
          console.log(
            `🧹 [LanguoidCleanup] Removing awaiting_cleanup flag from ${languoidsToCleanFlag.length} languoid(s) with no matches...`
          );

          const { getRawTableName } = await import('./utils');
          const languoidLocalRawTable = getRawTableName('languoid_local');

          for (const languoid of languoidsToCleanFlag) {
            // Remove awaiting_cleanup flag from metadata using raw PowerSync table
            // Use parameterized query to prevent SQL injection
            await system.powersync.execute(
              `
              UPDATE ${languoidLocalRawTable}
              SET data = json_set(
                data,
                '$._metadata',
                json_remove(
                  json(json_extract(data, '$._metadata')),
                  '$.awaiting_cleanup'
                )
              )
              WHERE id = ?
                AND json_extract(data, '$._metadata.awaiting_cleanup') = 1
            `,
              [languoid.id]
            );
          }

          console.log(
            `  ✓ Removed awaiting_cleanup flag from ${languoidsToCleanFlag.length} languoid(s)`
          );
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ [LanguoidCleanup] Error checking Supabase (non-critical):`,
        error
      );
      // Don't throw - offline or network errors shouldn't block cleanup
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ [LanguoidCleanup] No duplicate languoids found');
    return { cleanedCount: 0, duplicates: [], remoteOnly: remoteOnlyCount };
  }

  console.log(
    `🔍 [LanguoidCleanup] Found ${duplicates.length} duplicate languoid(s):`
  );
  duplicates.forEach((dup) => {
    console.log(`  - ${dup.id}: "${dup.name}"`);
  });

  let totalCleaned = 0;

  // Process each duplicate
  for (const duplicate of duplicates) {
    const localId = duplicate.id;
    const syncedId = duplicate.id; // Same ID, different tables

    console.log(
      `🔄 [LanguoidCleanup] Relinking references for languoid: ${localId}`
    );

    // 1. Update project_language_link_local references
    const projectLanguageLinkLocal = resolveTable('project_language_link', {
      localOverride: true
    });
    await system.db
      .update(projectLanguageLinkLocal)
      .set({ languoid_id: syncedId })
      .where(eq(projectLanguageLinkLocal.languoid_id, localId));

    console.log(`  ✓ Updated project_language_link_local references`);

    // 2. Update asset_content_link_local references
    const assetContentLinkLocal = resolveTable('asset_content_link', {
      localOverride: true
    });
    await system.db
      .update(assetContentLinkLocal)
      .set({ languoid_id: syncedId })
      .where(eq(assetContentLinkLocal.languoid_id, localId));

    console.log(`  ✓ Updated asset_content_link_local references`);

    // 3. Update profile_local.ui_languoid_id references (if any)
    const profileLocal = resolveTable('profile', { localOverride: true });
    await system.db
      .update(profileLocal)
      .set({ ui_languoid_id: syncedId })
      .where(eq(profileLocal.ui_languoid_id, localId));

    console.log(`  ✓ Updated profile_local references`);

    // 4. Delete the local languoid duplicate
    // Note: The awaiting_cleanup flag will be removed automatically when the record is deleted
    await system.db.delete(languoidLocal).where(eq(languoidLocal.id, localId));
    console.log(`  ✓ Deleted local languoid: ${localId}`);

    totalCleaned++;
  }

  console.log(
    `✅ [LanguoidCleanup] Cleaned up ${totalCleaned} duplicate languoid record(s)`
  );

  return {
    cleanedCount: totalCleaned,
    duplicates,
    remoteOnly: remoteOnlyCount
  };
}

/**
 * Register cleanup callback to run after PowerSync sync completes
 * This handles duplicate languoids created during migration that later get synced
 * Only registers if there are actually languoids with awaiting_cleanup flag
 */
export async function migrationCleanup(): Promise<void> {
  const { resolveTable } = await import('@/utils/dbUtils');

  // Check if there are any languoids with awaiting_cleanup flag using Drizzle
  let awaitingCleanupCount = 0;
  try {
    const languoidLocal = resolveTable('languoid', { localOverride: true });
    const localLanguoids = await system.db.select().from(languoidLocal);
    awaitingCleanupCount = localLanguoids.filter(
      (l) => l._metadata?.awaiting_cleanup === true
    ).length;
  } catch (error) {
    // If query fails, assume no languoids need cleanup (non-critical)
    console.warn(
      '[MigrationCleanup] Could not check for awaiting_cleanup languoids (non-critical):',
      error
    );
  }

  if (awaitingCleanupCount > 0) {
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
    console.log(
      `[MigrationCleanup] Registered languoid cleanup callback for next sync (${awaitingCleanupCount} languoid(s) awaiting cleanup)`
    );
  } else {
    console.log(
      '[MigrationCleanup] No languoids with awaiting_cleanup flag found - skipping cleanup callback registration'
    );
  }
}

/**
 * Preview duplicate languoids without deleting them
 */
export async function previewDuplicateLanguoids(): Promise<
  DuplicateLanguoid[]
> {
  console.log('🔍 [LanguoidCleanup] Previewing duplicate languoids...');

  const languoidLocal = resolveTable('languoid', { localOverride: true });
  const languoidSynced = resolveTable('languoid', { localOverride: false });

  const [localLanguoids, syncedLanguoids] = await Promise.all([
    system.db.select().from(languoidLocal),
    system.db.select().from(languoidSynced)
  ]);

  const localMap = new Map(localLanguoids.map((l) => [l.id, l]));
  const syncedMap = new Map(syncedLanguoids.map((l) => [l.id, l]));

  const duplicates: DuplicateLanguoid[] = [];
  localMap.forEach((localLanguoid, id) => {
    if (syncedMap.has(id)) {
      duplicates.push({
        id,
        name: localLanguoid.name,
        source: 'local'
      });
    }
  });

  console.log(`Found ${duplicates.length} duplicate languoid(s)`);
  return duplicates;
}
