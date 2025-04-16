import { useQuery } from '@powersync/tanstack-react-query';
import { system } from '../db/powersync/system';
import { AttachmentRecord } from '@powersync/attachments';
import { ExtendedAttachmentRecord } from '@/db/powersync/AbstractSharedAttachmentQueue';

export function useAttachmentQuery(attachmentIds: string[]) {
  console.log('useAttachmentQuery', attachmentIds);
  return useQuery({
    queryKey: ['attachments', attachmentIds],
    query: `SELECT * FROM attachments WHERE id IN (${attachmentIds.map((id) => `'${id}'`).join(',')}) AND storage_type = 'permanent'`,
    enabled: attachmentIds.length > 0
  });
}
