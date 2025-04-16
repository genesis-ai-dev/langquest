import { useState, useEffect } from 'react';
import { getAssetAttachmentIds } from '../utils/attachmentUtils';
import { AttachmentState } from '@powersync/attachments';
import { useAttachmentQuery } from './useAttachmentQuery';
import { ExtendedAttachmentRecord } from '@/db/powersync/AbstractSharedAttachmentQueue';

export function useAssetDownloadStatus(assetId: string) {
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const { data: attachments = [] } = useAttachmentQuery(attachmentIds);

  useEffect(() => {
    if (!assetId) return;

    const fetchAttachmentIds = async () => {
      const ids = await getAssetAttachmentIds(assetId);
      setAttachmentIds(ids);
    };

    fetchAttachmentIds();
  }, [assetId]);

  // If we have no attachments, consider it downloaded
  if (attachmentIds.length === 0) {
    console.log(
      'Consider as downloaded, no attachments found for asset',
      assetId
    );
    return true;
  }

  // Check if all attachments are either SYNCED or QUEUED_UPLOAD
  console.log(
    'Attachment Ids found for asset with getAssetAttachmentIds',
    assetId,
    attachmentIds
  );
  console.log('Attachments found with query', attachments);

  // If we have attachment IDs but no attachments found in the query,
  // they are not downloaded
  if (attachments.length === 0) {
    console.log('No attachments found in database for asset', assetId);
    return false;
  }

  return (attachments as ExtendedAttachmentRecord[]).every(
    (attachment) =>
      attachment.state === AttachmentState.SYNCED ||
      attachment.state === AttachmentState.QUEUED_UPLOAD
  );
}
