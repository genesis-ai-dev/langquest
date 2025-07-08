import type { ExtendedAttachmentRecord } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { AttachmentStateManager } from '@/db/powersync/AttachmentStateManager';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { AttachmentState } from '@powersync/attachments';
import { useEffect, useState } from 'react';

export function useAttachmentAssetDownloadStatus(assetIds: string[]) {
  // Use unified AttachmentStateManager for consistent attachment ID collection
  const [attachmentStateManager] = useState(
    () => new AttachmentStateManager(system.db)
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      attachmentStateManager.destroy();
    };
  }, [attachmentStateManager]);

  // Get attachment IDs using unified approach
  const { data: attachmentIds = [] } = useHybridQuery({
    queryKey: ['asset-attachments', assetIds],
    onlineFn: async () => {
      console.log(
        `[ASSET DOWNLOAD STATUS] Getting attachment IDs for assets (ONLINE): ${assetIds.join(', ')}`
      );
      const attachmentIds =
        await attachmentStateManager.getAttachmentIdsForAssets(assetIds);
      console.log(
        `[ASSET DOWNLOAD STATUS] Found ${attachmentIds.length} attachment IDs (ONLINE): ${attachmentIds.join(', ')}`
      );

      // Return as array of objects for useHybridQuery compatibility
      return attachmentIds.map((id) => ({ id }));
    },
    offlineFn: async () => {
      console.log(
        `[ASSET DOWNLOAD STATUS] Getting attachment IDs for assets (OFFLINE): ${assetIds.join(', ')}`
      );
      const attachmentIds =
        await attachmentStateManager.getAttachmentIdsForAssets(assetIds);
      console.log(
        `[ASSET DOWNLOAD STATUS] Found ${attachmentIds.length} attachment IDs (OFFLINE): ${attachmentIds.join(', ')}`
      );

      // Return as array of objects for useHybridQuery compatibility
      return attachmentIds.map((id) => ({ id }));
    },
    enabled: assetIds.length > 0
  });

  // Extract the actual IDs from the wrapper objects
  const actualAttachmentIds = attachmentIds.map((item) => item.id);

  // Get attachment states using PowerSync directly (since attachment table is managed by PowerSync, not Drizzle)
  const { data: attachments = [] } = useHybridQuery({
    queryKey: ['attachments', actualAttachmentIds],
    onlineFn: async () => {
      console.log(
        `[ASSET DOWNLOAD STATUS] Getting attachment states (ONLINE) for ${actualAttachmentIds.length} attachments`
      );
      const { data, error } = await system.supabaseConnector.client
        .from('attachment')
        .select('*')
        .in('id', actualAttachmentIds)
        .eq('storage_type', 'permanent');
      if (error) throw error;
      console.log(
        `[ASSET DOWNLOAD STATUS] Retrieved ${data.length} attachment records (ONLINE)`
      );
      return data as Record<string, unknown>[];
    },
    offlineFn: async () => {
      console.log(
        `[ASSET DOWNLOAD STATUS] Getting attachment states (OFFLINE) for ${actualAttachmentIds.length} attachments`
      );

      // Use PowerSync direct query since attachment table is managed by PowerSync
      if (actualAttachmentIds.length === 0) return [];

      const formattedIds = actualAttachmentIds.map((id) => `'${id}'`).join(',');
      const result = await system.powersync.execute(
        `SELECT * FROM attachments WHERE id IN (${formattedIds}) AND storage_type = 'permanent'`
      );

      const attachments: Record<string, unknown>[] = [];
      if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i) as Record<string, unknown>;
          attachments.push(row);
        }
      }

      console.log(
        `[ASSET DOWNLOAD STATUS] Retrieved ${attachments.length} attachment records (OFFLINE)`
      );
      return attachments;
    },
    enabled: actualAttachmentIds.length > 0
  });

  // If we have no attachments for any asset, consider it not downloaded
  if (actualAttachmentIds.length === 0) {
    console.log(
      `[ASSET DOWNLOAD STATUS] No attachments found for assets: ${assetIds.join(', ')}`
    );
    return { isDownloaded: false, isLoading: false };
  }

  // Check if all attachments are either SYNCED or QUEUED_UPLOAD
  console.log(`[ASSET DOWNLOAD STATUS] Checking download status:`);
  console.log(
    `  - Expected attachment IDs (${actualAttachmentIds.length}): ${actualAttachmentIds.join(', ')}`
  );
  console.log(
    `  - Found attachment records (${attachments.length}): ${attachments.map((a) => `${String(a.id)}:${String(a.state)}`).join(', ')}`
  );

  // If we have fewer attachments than attachmentIds, some attachments are missing from attachments table
  if (attachments.length < actualAttachmentIds.length) {
    const missingIds = actualAttachmentIds.filter(
      (id) => !attachments.some((a) => a.id === id)
    );
    console.log(
      `[ASSET DOWNLOAD STATUS] Missing attachment records for: ${missingIds.join(', ')}`
    );
    return { isDownloaded: false, isLoading: false };
  }

  console.log('TYPES: attachments', { attachments });
  const isDownloaded = (
    attachments as unknown as ExtendedAttachmentRecord[]
  ).every(
    (attachment) =>
      attachment.state === AttachmentState.SYNCED ||
      attachment.state === AttachmentState.QUEUED_UPLOAD
  );

  const isLoading = (attachments as unknown as ExtendedAttachmentRecord[]).some(
    (attachment) =>
      attachment.state === AttachmentState.QUEUED_DOWNLOAD ||
      attachment.state === AttachmentState.QUEUED_SYNC
  );

  console.log(
    `[ASSET DOWNLOAD STATUS] Final status: isDownloaded=${isDownloaded}, isLoading=${isLoading}`
  );
  return { isDownloaded, isLoading };
}
