import { system } from '../db/powersync/system';
import { and, eq } from 'drizzle-orm';
import { asset_download } from '../db/drizzleSchema';
import { AbstractSharedAttachmentQueue } from '../db/powersync/AbstractSharedAttachmentQueue';

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
    // Check if user has actively downloaded this asset
    const currentUserId = await system.permAttachmentQueue?.getCurrentUserId();
    if (!currentUserId) {
      return;
    }

    // First check if the asset is already in permanent downloads
    const activeDownload = await system.db.query.asset_download.findFirst({
      where: and(
        eq(asset_download.profile_id, currentUserId),
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
      (await system.permAttachmentQueue?.getAllAssetAttachments(assetId)) || [];

    // For each attachment, check if it's already in the database with any storage type
    let allAlreadyDownloaded = attachmentIds.length > 0;

    for (const attachmentId of attachmentIds) {
      const record =
        await system.permAttachmentQueue?.getExtendedRecord(attachmentId);

      // If any attachment doesn't exist or isn't synced, we need to add to temp queue
      if (!record || record.state !== 3) {
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
    const tempQueue = system.tempAttachmentQueue as any;
    if (tempQueue && typeof tempQueue.addTempAsset === 'function') {
      await tempQueue.addTempAsset(assetId);
    } else {
      console.warn('Temporary attachment queue not properly initialized');
    }
  } catch (error) {
    console.error(
      `[ensureAssetLoaded] Error ensuring asset is loaded: ${error}`
    );
  }
}
