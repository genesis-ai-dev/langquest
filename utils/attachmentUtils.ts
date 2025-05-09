import type { TempAttachmentQueue } from '@/db/powersync/TempAttachmentQueue';
import { AttachmentState } from '@powersync/attachments';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { asset_download } from '../db/drizzleSchema';
import { AbstractSharedAttachmentQueue } from '../db/powersync/AbstractSharedAttachmentQueue';
import { system } from '../db/powersync/system';

export async function getLocalUriFromAssetId(assetId: string, retryCount = 3) {
  // With the shared directory approach, we just need to check
  // if the file exists in the shared directory
  const fullPath = `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${assetId}`;
  const sharedUri = system.permAttachmentQueue?.getLocalUri(fullPath);

  if (sharedUri) {
    const exists = await system.storage.fileExists(sharedUri);

    if (exists) {
      return sharedUri;
    } else if (retryCount > 0) {
      // Add a small delay before retrying
      await new Promise((resolve) => setTimeout(resolve, 100));
      return getLocalUriFromAssetId(assetId, retryCount - 1);
    }
  }

  return null;
}

// Helper to load an asset into the temp queue if not already available
export async function ensureAssetLoaded(assetId: string): Promise<void> {
  if (!assetId) {
    return;
  }

  try {
    // First check if the asset is already in permanent downloads
    const activeDownload = await system.db.query.asset_download.findFirst({
      where: and(
        eq(asset_download.asset_id, assetId),
        eq(asset_download.active, true)
      )
    });

    // If asset is already in permanent downloads, no need to add to temp
    if (activeDownload) {
      return;
    }

    // Check if the attachment already exists in the database
    const attachmentIds =
      (await system.permAttachmentQueue?.getAllAssetAttachments(assetId)) ?? [];

    // For each attachment, check if it's already in the database with any storage type
    let allAlreadyDownloaded = attachmentIds.length > 0;

    for (const attachmentId of attachmentIds) {
      const record =
        await system.permAttachmentQueue?.getExtendedRecord(attachmentId);

      // If any attachment doesn't exist or isn't synced, we need to add to temp queue
      if (!record || record.state !== AttachmentState.SYNCED) {
        // 3 = SYNCED
        allAlreadyDownloaded = false;
        break;
      }
    }

    // If all attachments are already downloaded, no need to add to temp queue
    if (allAlreadyDownloaded) {
      return;
    }

    // Otherwise, add to temp queue
    const tempQueue = system.tempAttachmentQueue as
      | (TempAttachmentQueue & {
          addTempAsset: (assetId: string) => Promise<void>;
        })
      | undefined;
    if (tempQueue && typeof tempQueue.addTempAsset === 'function') {
      await tempQueue.addTempAsset(assetId);
    } else {
      console.warn('Temporary attachment queue not properly initialized');
    }
  } catch (error) {
    console.error(
      `[ensureAssetLoaded] Error ensuring asset is loaded: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function calculateTotalAttachments(
  assetIds: string[]
): Promise<number> {
  try {
    let totalAttachments = 0;

    for (const assetId of assetIds) {
      // 1. Get the asset itself for images
      const assetRecord = await system.db.query.asset.findFirst({
        where: (a) => eq(a.id, assetId)
      });

      if (assetRecord?.images) {
        totalAttachments += assetRecord.images.length;
      }

      // 2. Get asset_content_link entries for audio
      const assetContents = await system.db.query.asset_content_link.findMany({
        where: (acl) => and(eq(acl.asset_id, assetId), isNotNull(acl.audio_id))
      });

      const contentAudioIds = assetContents
        .filter((content) => content.audio_id)
        .map((content) => content.audio_id!);

      totalAttachments += contentAudioIds.length;

      // 3. Get translations for the asset and their audio
      const translations = await system.db.query.translation.findMany({
        where: (t) => and(eq(t.asset_id, assetId), isNotNull(t.audio))
      });

      const translationAudioIds = translations
        .filter((translation) => translation.audio)
        .map((translation) => translation.audio!);

      totalAttachments += translationAudioIds.length;
    }

    return totalAttachments;
  } catch (error) {
    console.error('Error calculating total attachments:', error);
    return 0;
  }
}

export async function getAssetAttachmentIds(
  assetIds: string[]
): Promise<string[]> {
  const startTime = performance.now();
  try {
    const attachmentIds: string[] = [];

    // Execute all queries in parallel using Promise.allSettled
    const [assetResult, contentResult, translationResult] =
      await Promise.allSettled([
        // 1. Get the assets for images
        system.db.query.asset.findMany({
          where: (a) => inArray(a.id, assetIds)
        }),
        // 2. Get asset_content_link entries for audio
        system.db.query.asset_content_link.findMany({
          where: (acl) =>
            and(inArray(acl.asset_id, assetIds), isNotNull(acl.audio_id))
        }),
        // 3. Get translations for the assets and their audio
        system.db.query.translation.findMany({
          where: (t) => and(inArray(t.asset_id, assetIds), isNotNull(t.audio))
        })
      ]);

    // Process asset images if successful
    if (assetResult.status === 'fulfilled') {
      assetResult.value.forEach((asset) => {
        if (asset.images) {
          attachmentIds.push(...asset.images);
        }
      });
    }

    // Process content audio IDs if successful
    if (contentResult.status === 'fulfilled') {
      const contentAudioIds = contentResult.value
        .filter((content) => content.audio_id)
        .map((content) => content.audio_id!);
      attachmentIds.push(...contentAudioIds);
    }

    // Process translation audio IDs if successful
    if (translationResult.status === 'fulfilled') {
      const translationAudioIds = translationResult.value
        .filter((translation) => translation.audio)
        .map((translation) => translation.audio!);
      attachmentIds.push(...translationAudioIds);
    }

    // Return unique attachment IDs
    const uniqueAttachmentIds = [...new Set(attachmentIds)];

    console.log(`Total execution time: ${performance.now() - startTime}ms`);
    console.log(
      `Found ${uniqueAttachmentIds.length} unique attachments for ${assetIds.length} assets`
    );

    return uniqueAttachmentIds;
  } catch (error) {
    console.error('Error getting asset attachment IDs:', error);
    console.log(`Failed after ${performance.now() - startTime}ms`);
    return [];
  }
}

/**
 * Get files that are still in the upload queue (not yet synced)
 * @returns Promise resolving to array of file IDs that need to be synced
 */
export async function getFilesInUploadQueue(): Promise<string[]> {
  if (!system.powersync) {
    console.log(
      '[getFilesInUploadQueue] PowerSync system not available, returning empty array.'
    );
    return [];
  }

  try {
    // Get files that are in QUEUED_UPLOAD state (pending sync)
    const result = await system.powersync.execute(
      'SELECT id FROM attachments WHERE state = ?',
      [String(AttachmentState.QUEUED_UPLOAD)]
    );

    const files: string[] = [];
    // Add null check for rows
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        // Add null check for item before accessing id
        const item: { id?: string | null } | null = result.rows.item(i);
        if (item?.id) {
          files.push(item.id);
        }
      }
    }
    return files;
  } catch (error) {
    console.error('Error checking upload queue:', error);
    return [];
  }
}

/**
 * Check if all files have been synced
 * @returns Promise resolving to boolean indicating if all files are synced
 */
export async function areAllFilesSynced(): Promise<boolean> {
  const filesInQueue = await getFilesInUploadQueue();
  return filesInQueue.length === 0;
}

/**
 * Checks if a file has been synced to the cloud
 * @param fileId The ID of the file to check
 * @returns Promise resolving to a boolean indicating sync status
 */
export async function isFileSynced(fileId: string): Promise<boolean> {
  if (!system.powersync) {
    return false;
  }

  try {
    // Query the PowerSync attachment table
    const result = await system.powersync.execute(
      'SELECT state FROM attachments WHERE id = ?',
      [fileId]
    );

    // Add null check for rows
    if (!result.rows || result.rows.length === 0) {
      return false; // File not found in attachments table
    }

    const item: { state?: number | null } | null = result.rows.item(0);
    const state: number | null | undefined = item?.state;
    // File is synced if state is SYNCED
    return state === AttachmentState.SYNCED;
  } catch (error) {
    console.error('Error checking file sync status:', error);
    return false;
  }
}

/**
 * Gets all files with their sync status
 * @returns Promise resolving to an array of {id, state} objects
 */
export async function getAllFilesSyncStatus(): Promise<
  { id: string; synced: boolean }[]
> {
  if (!system.powersync) {
    return [];
  }

  try {
    // Correct execute call signature
    const result = await system.powersync.execute(
      'SELECT id, state FROM attachments'
    );

    const files: { id: string; synced: boolean }[] = [];
    // Add null check for rows
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        const item: { id?: string | null; state?: number | null } | null =
          result.rows.item(i);
        if (item?.id) {
          // Ensure item and id exist
          files.push({
            id: item.id,
            // File is synced if state is SYNCED
            synced: item.state === AttachmentState.SYNCED
          });
        }
      }
    }

    return files;
  } catch (error) {
    console.error('Error getting files sync status:', error);
    return [];
  }
}
