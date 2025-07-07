import { toCompilableQuery } from '@/db/drizzle/utils';
import type { ExtendedAttachmentRecord } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { AttachmentState } from '@powersync/attachments';
import { and, eq, inArray } from 'drizzle-orm';
import { getAssetAttachmentIds } from '../utils/attachmentUtils';

export function useAttachmentAssetDownloadStatus(assetIds: string[]) {
  const { data: attachmentIds = [] } = useHybridQuery({
    queryKey: ['asset-attachments', assetIds],
    onlineFn: async () => {
      const attachmentIds = await getAssetAttachmentIds(assetIds);
      return attachmentIds;
    }
  });

  const { data: attachments = [] } = useHybridQuery({
    queryKey: ['attachments', attachmentIds],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('attachment')
        .select('*')
        .in('id', attachmentIds)
        .eq('storage_type', 'permanent');
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.attachment.findMany({
        where: and(
          inArray(attachment.id, attachmentIds),
          eq(attachment.storage_type, 'permanent')
        )
      })
    ),
    enabled: attachmentIds.length > 0
  });

  // If we have no attachments for any asset, consider it not downloaded
  if (attachmentIds.length === 0) {
    // console.log(
    //   'Consider as not downloaded, no attachments found for assets',
    //   assetIds
    // );
    return { isDownloaded: false, isLoading: false };
  }

  // Check if all attachments are either SYNCED or QUEUED_UPLOAD
  // console.log(
  //   'Attachment Ids found for assets with getAssetAttachmentIds',
  //   assetIds,
  //   'attachmentIds',
  //   attachmentIds
  // );
  // console.log('Attachments found with query', attachments);

  // If we have fewer attachments than attachmentIds, some attachments are missing from attachments table
  if (attachments.length < attachmentIds.length) {
    // console.log('Some attachments not found in database for assets', assetIds);
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
