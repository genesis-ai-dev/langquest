import type { ExtendedAttachmentRecord } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { AttachmentState } from '@powersync/attachments';
import { useQuery } from '@powersync/tanstack-react-query';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { getAssetAttachmentIds } from '../utils/attachmentUtils';

export function useAssetDownloadStatus(assetIds: string[]) {
  const { data: attachmentIds = [] } = useQuery({
    queryKey: ['asset-attachments', assetIds],
    queryFn: () => getAssetAttachmentIds(assetIds)
  });

  // Use parameterized query instead of string interpolation for better performance
  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', attachmentIds],
    query:
      attachmentIds.length > 0
        ? `SELECT * FROM attachments WHERE id IN (${attachmentIds.map(() => '?').join(',')}) AND storage_type = 'permanent'`
        : 'SELECT * FROM attachments WHERE 1=0', // No results query
    parameters: attachmentIds,
    enabled: attachmentIds.length > 0
  });

  // Move state checks off main thread to prevent blocking
  const [downloadState, setDownloadState] = useState({
    isDownloaded: false,
    isLoading: false
  });

  useEffect(() => {
    // Early returns for simple cases (don't need InteractionManager)
    if (attachmentIds.length === 0) {
      setDownloadState({ isDownloaded: false, isLoading: false });
      return;
    }

    if (attachments.length < attachmentIds.length) {
      // Some attachments missing - not fully downloaded
      setDownloadState({ isDownloaded: false, isLoading: false });
      return;
    }

    // Defer state checking to prevent blocking UI interactions
    const handle = InteractionManager.runAfterInteractions(() => {
      const isDownloaded = (attachments as ExtendedAttachmentRecord[]).every(
        (attachment) =>
          attachment.state === AttachmentState.SYNCED ||
          attachment.state === AttachmentState.QUEUED_UPLOAD
      );

      const isLoading = (attachments as ExtendedAttachmentRecord[]).some(
        (attachment) =>
          attachment.state === AttachmentState.QUEUED_DOWNLOAD ||
          attachment.state === AttachmentState.QUEUED_SYNC
      );

      setDownloadState({ isDownloaded, isLoading });
    });

    return () => handle.cancel();
  }, [attachmentIds.length, attachments]);

  return downloadState;
}
