import { system } from '../db/powersync/system';
import { and, eq } from 'drizzle-orm';
import { asset_download } from '../db/drizzleSchema';
import { AbstractSharedAttachmentQueue } from '../db/powersync/AbstractSharedAttachmentQueue';

export async function getLocalUriFromAssetId(assetId: string, retryCount = 3) {
  // With the shared directory approach, we just need to check
  // if the file exists in the shared directory
  console.log(
    `[getLocalUriFromAssetId] Starting lookup for assetId: ${assetId}`
  );

  const fullPath = `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${assetId}`;
  console.log(`[getLocalUriFromAssetId] Checking path: ${fullPath}`);

  const sharedUri = system.permAttachmentQueue?.getLocalUri(fullPath);
  console.log(
    `[getLocalUriFromAssetId] Retrieved sharedUri: ${sharedUri || 'null'}`
  );

  if (sharedUri) {
    console.log(
      `[getLocalUriFromAssetId] Checking if file exists at: ${sharedUri}`
    );
    const exists = await system.storage.fileExists(sharedUri);
    console.log(`[getLocalUriFromAssetId] File exists: ${exists}`);

    if (exists) {
      console.log(
        `[getLocalUriFromAssetId] Successfully found file for assetId: ${assetId}`
      );
      return sharedUri;
    } else if (retryCount > 0) {
      // Add a small delay before retrying
      await new Promise((resolve) => setTimeout(resolve, 100));
      return getLocalUriFromAssetId(assetId, retryCount - 1);
    }
  }

  console.log(
    `[getLocalUriFromAssetId] No local URI found for assetId: ${assetId}`
  );
  return null;
}

// Helper to load an asset into the temp queue if not already available
export async function ensureAssetLoaded(assetId: string): Promise<void> {
  console.log(`[ensureAssetLoaded] Starting for assetId: ${assetId}`);
  if (!assetId) {
    console.log('[ensureAssetLoaded] No assetId provided, returning early');
    return;
  }

  try {
    // Check if user has actively downloaded this asset
    console.log('[ensureAssetLoaded] Getting current user ID');
    const currentUserId = await system.permAttachmentQueue?.getCurrentUserId();
    if (!currentUserId) {
      console.log(
        '[ensureAssetLoaded] No current user ID found, returning early'
      );
      return;
    }
    console.log(`[ensureAssetLoaded] Current user ID: ${currentUserId}`);

    // First check if the asset is already in permanent downloads
    console.log(
      '[ensureAssetLoaded] Checking if asset is in permanent downloads'
    );
    const activeDownload = await system.db.query.asset_download.findFirst({
      where: and(
        eq(asset_download.profile_id, currentUserId),
        eq(asset_download.asset_id, assetId),
        eq(asset_download.active, true)
      )
    });

    // If asset is already in permanent downloads, no need to add to temp
    if (activeDownload) {
      console.log(
        '[ensureAssetLoaded] Asset already in permanent downloads, no action needed'
      );
      return;
    }
    console.log('[ensureAssetLoaded] Asset not found in permanent downloads');

    // Check if the attachment already exists in the database
    console.log('[ensureAssetLoaded] Getting all asset attachments');
    const attachmentIds =
      (await system.permAttachmentQueue?.getAllAssetAttachments(assetId)) || [];
    console.log(
      `[ensureAssetLoaded] Found ${attachmentIds.length} attachments for asset`
    );

    // For each attachment, check if it's already in the database with any storage type
    let allAlreadyDownloaded = attachmentIds.length > 0;
    console.log(
      `[ensureAssetLoaded] Initial allAlreadyDownloaded status: ${allAlreadyDownloaded}`
    );

    for (const attachmentId of attachmentIds) {
      console.log(`[ensureAssetLoaded] Checking attachment: ${attachmentId}`);
      const record =
        await system.permAttachmentQueue?.getExtendedRecord(attachmentId);
      console.log(
        `[ensureAssetLoaded] Record state for ${attachmentId}: ${record?.state}`
      );

      // If any attachment doesn't exist or isn't synced, we need to add to temp queue
      if (!record || record.state !== 3) {
        // 3 = SYNCED
        console.log(
          `[ensureAssetLoaded] Attachment ${attachmentId} not synced (state: ${record?.state})`
        );
        allAlreadyDownloaded = false;
        break;
      }
    }

    // If all attachments are already downloaded, no need to add to temp queue
    if (allAlreadyDownloaded) {
      console.log(
        '[ensureAssetLoaded] All attachments already downloaded, no action needed'
      );
      return;
    }
    console.log('[ensureAssetLoaded] Some attachments need to be downloaded');

    // Otherwise, add to temp queue
    console.log('[ensureAssetLoaded] Adding asset to temporary queue');
    const tempQueue = system.tempAttachmentQueue as any;
    if (tempQueue && typeof tempQueue.addTempAsset === 'function') {
      await tempQueue.addTempAsset(assetId);
      console.log(
        `[ensureAssetLoaded] Successfully added assetId ${assetId} to temp queue`
      );
    } else {
      console.warn('Temporary attachment queue not properly initialized');
    }
  } catch (error) {
    console.error(
      `[ensureAssetLoaded] Error ensuring asset is loaded: ${error}`
    );
  }
}
