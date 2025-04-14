import { useState, useEffect, useRef } from 'react';
import { system } from '../db/powersync/system';
import { getAssetAttachmentIds } from '../utils/attachmentUtils';
import { AttachmentState, AttachmentRecord } from '@powersync/attachments';

export function useAssetDownloadStatus(assetId: string) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const watchControllerRef = useRef<AbortController | null>(null);
  const processedAttachmentStates = useRef<Map<string, number>>(new Map());
  const currentAttachmentIds = useRef<string[]>([]);

  const checkDownloadStatus = (attachmentIds: string[]) => {
    // If we have no attachments, consider it downloaded
    if (attachmentIds.length === 0) {
      return true;
    }

    // Check if all attachments are either SYNCED or QUEUED_UPLOAD
    return attachmentIds.every((id) => {
      const state = processedAttachmentStates.current.get(id);
      return (
        state === AttachmentState.SYNCED ||
        state === AttachmentState.QUEUED_UPLOAD
      );
    });
  };

  useEffect(() => {
    console.log('[useAssetDownloadStatus] Hook called with assetId:', assetId);

    // Clear the processed states when assetId changes
    processedAttachmentStates.current.clear();
    currentAttachmentIds.current = [];

    if (!assetId) {
      console.log('[useAssetDownloadStatus] No asset ID provided');
      setIsDownloaded(false);
      return;
    }

    // Create a new abort controller for this watch
    const abortController = new AbortController();
    watchControllerRef.current = abortController;

    const setupWatch = async () => {
      try {
        // Get all attachment IDs for this asset
        const attachmentIds = await getAssetAttachmentIds(assetId);
        console.log(
          '[useAssetDownloadStatus] Found attachments:',
          attachmentIds
        );

        // Store current attachment IDs
        currentAttachmentIds.current = attachmentIds;

        // Format the IDs for the SQL query
        const idsString = attachmentIds.map((id) => `'${id}'`).join(',');

        // Set up the watch
        system.powersync.watch(
          `SELECT * FROM attachments WHERE id IN (${idsString}) AND storage_type = 'permanent'`,
          [],
          {
            onResult: (result) => {
              const attachments = (result.rows?._array ||
                []) as AttachmentRecord[];
              console.log(
                '[useAssetDownloadStatus] Attachment states updated:',
                attachments
              );

              // Clear previous states for current attachments
              for (const id of currentAttachmentIds.current) {
                processedAttachmentStates.current.delete(id);
              }

              // Update states for all attachments in the result
              for (const attachment of attachments) {
                processedAttachmentStates.current.set(
                  attachment.id,
                  attachment.state
                );
              }

              // Check download status
              const allDownloaded = checkDownloadStatus(
                currentAttachmentIds.current
              );
              setIsDownloaded(allDownloaded);
            }
          },
          { signal: abortController.signal }
        );

        // Also make an immediate query to get current states
        const currentAttachments =
          await system.powersync.getAll<AttachmentRecord>(
            `SELECT * FROM attachments WHERE id IN (${idsString})`
          );

        // Process initial states
        for (const attachment of currentAttachments) {
          processedAttachmentStates.current.set(
            attachment.id,
            attachment.state
          );
        }

        // Check initial download status
        const initialDownloaded = checkDownloadStatus(attachmentIds);
        setIsDownloaded(initialDownloaded);
      } catch (error) {
        console.error(
          '[useAssetDownloadStatus] Error setting up watch:',
          error
        );
        setIsDownloaded(false);
      }
    };

    setupWatch();

    // Clean up function
    return () => {
      console.log('[useAssetDownloadStatus] Cleaning up watch');
      if (watchControllerRef.current) {
        watchControllerRef.current.abort();
        watchControllerRef.current = null;
      }
    };
  }, [assetId]);

  return isDownloaded;
}
