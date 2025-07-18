import {
  getAssetAudioContent,
  getAssetById,
  getAssetsById,
  getAssetsContent
} from '@/hooks/db/useAssets';
import {
  getTranslationsByAssetIds,
  getTranslationsWithAudioByAssetId
} from '@/hooks/db/useTranslations';
import { AttachmentState } from '@powersync/attachments';
import { AbstractSharedAttachmentQueue } from '../db/powersync/AbstractSharedAttachmentQueue';
import { system } from '../db/powersync/system';

export function getOnlineUriForFilePath(filePath: string) {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.EXPO_PUBLIC_SUPABASE_BUCKET}/${filePath}`;
}

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

export async function calculateTotalAttachments(assetIds: string[]) {
  try {
    let totalAttachments = 0;

    for (const assetId of assetIds) {
      // 1. Get the asset itself for images
      const assetRecord = await getAssetById(assetId);

      if (assetRecord?.images) {
        totalAttachments += assetRecord.images.length;
      }

      // 2. Get asset_content_link entries for audio
      const assetContents = await getAssetAudioContent(assetId);

      const contentAudioIds = assetContents
        ?.filter((content) => content.audio_id)
        .map((content) => content.audio_id!);

      if (contentAudioIds) {
        totalAttachments += contentAudioIds.length;
      }

      // 3. Get translations for the asset and their audio
      const translations = await getTranslationsWithAudioByAssetId(assetId);

      const translationAudioIds = translations
        ?.filter((translation) => translation.audio && translation.audio.trim() !== '')
        .map((translation) => translation.audio!);

      if (translationAudioIds) {
        totalAttachments += translationAudioIds.length;
      }
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
        await getAssetsById(assetIds),
        // 2. Get asset_content_link entries for audio
        await getAssetsContent(assetIds),
        // 3. Get translations for the assets and their audio
        await getTranslationsByAssetIds(assetIds)
      ]);

    // Process asset images if successful
    if (assetResult.status === 'fulfilled') {
      assetResult.value?.forEach((asset) => {
        if (asset.images) {
          attachmentIds.push(...asset.images);
        }
      });
    }

    // Process content audio IDs if successful
    if (contentResult.status === 'fulfilled') {
      const contentAudioIds = contentResult.value
        ?.filter((content) => content.audio_id)
        .map((content) => content.audio_id!);
      if (contentAudioIds) {
        attachmentIds.push(...contentAudioIds);
      }
    }

    // Process translation audio IDs if successful
    if (translationResult.status === 'fulfilled') {
      const translationAudioIds = translationResult.value
        ?.filter((translation) => translation.audio && translation.audio.trim() !== '')
        .map((translation) => translation.audio!);
      if (translationAudioIds) {
        attachmentIds.push(...translationAudioIds);
      }
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
export async function getFilesInUploadQueue() {
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
        const item = result.rows.item(i) as { id?: string | null } | null;
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

    const item = result.rows.item(0) as { state?: number | null } | null;
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
  try {
    // Correct execute call signature
    const result = await system.powersync.execute(
      'SELECT id, state FROM attachments'
    );

    const files: { id: string; synced: boolean }[] = [];
    // Add null check for rows
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        const item = result.rows.item(i) as {
          id?: string | null;
          state?: number | null;
        } | null;
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
