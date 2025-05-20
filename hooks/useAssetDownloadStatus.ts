import type { ExtendedAttachmentRecord } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { AttachmentState } from '@powersync/attachments';
import { useQuery } from '@powersync/tanstack-react-query';
import { getAssetAttachmentIds } from '../utils/attachmentUtils';

export function useAssetDownloadStatus(assetIds: string[]) {
  const { data: attachmentIds = [] } = useQuery({
    queryKey: ['asset-attachments', assetIds],
    queryFn: () => getAssetAttachmentIds(assetIds)
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', attachmentIds],
    query: `SELECT * FROM attachments WHERE id IN (${attachmentIds.map((id) => `'${id}'`).join(',')}) AND storage_type = 'permanent'`,
    enabled: attachmentIds.length > 0
  });

  // If we have no attachments for any asset, consider it not downloaded
  if (attachmentIds.length === 0) {
    console.log(
      'Consider as not downloaded, no attachments found for assets',
      assetIds
    );
    return { isDownloaded: false, isLoading: false };
  }

  // Check if all attachments are either SYNCED or QUEUED_UPLOAD
  console.log(
    'Attachment Ids found for assets with getAssetAttachmentIds',
    assetIds,
    attachmentIds
  );
  console.log('Attachments found with query', attachments);

  // If we have fewer attachments than attachmentIds, some attachments are missing from attachments table
  if (attachments.length < attachmentIds.length) {
    console.log('Some attachments not found in database for assets', assetIds);
    return { isDownloaded: false, isLoading: false };
  }

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

  return { isDownloaded, isLoading };
}
