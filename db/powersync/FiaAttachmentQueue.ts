import {
  deleteFiaPericopeCache,
  fetchAndCacheFiaPericope,
  getCachedFiaPericope
} from '@/utils/fia-cache';
import { getLocalUri } from '@/utils/fileUtils';
import type { AttachmentRecord } from '@powersync/attachments';
import {
  AbstractAttachmentQueue,
  AttachmentState
} from '@powersync/attachments';
import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/common';
import type { SupabaseConnector } from '../supabase/SupabaseConnector';
import { FiaStorageAdapter } from './FiaStorageAdapter';

const FIA_CACHE_DIR = 'fia_attachments';
const FIA_TABLE_NAME = 'fia_attachments';

function pericopeCacheLocalUri(pericopeId: string): string {
  const parts = pericopeId.split('-');
  return `${FIA_CACHE_DIR}/${parts.join('/')}/response.json`;
}

export class FiaAttachmentQueue extends AbstractAttachmentQueue {
  private supabaseConnector: SupabaseConnector;

  constructor(options: {
    powersync: AbstractPowerSyncDatabase;
    supabaseConnector: SupabaseConnector;
  }) {
    super({
      powersync: options.powersync,
      storage: new FiaStorageAdapter(),
      attachmentDirectoryName: FIA_CACHE_DIR,
      attachmentTableName: FIA_TABLE_NAME,
      downloadAttachments: true,
      performInitialSync: false,
      syncInterval: 60_000,
      cacheLimit: 500,
      onDownloadError: async (_attachment, exception) => {
        console.error('[FIA Queue] Download error:', exception);
        return { retry: true };
      }
    });
    this.supabaseConnector = options.supabaseConnector;
  }

  getLocalUri(filePath: string): string {
    return getLocalUri(filePath);
  }

  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    this.powersync.watch(
      `SELECT DISTINCT
          project_id || '__' || json_extract(metadata, '$.fia.pericopeId') as id
       FROM quest_synced
       WHERE json_extract(metadata, '$.fia.pericopeId') IS NOT NULL
       UNION
       SELECT DISTINCT
          project_id || '__' || json_extract(metadata, '$.fia.pericopeId') as id
       FROM quest_local
       WHERE json_extract(metadata, '$.fia.pericopeId') IS NOT NULL`,
      [],
      {
        onResult: (result) => {
          const ids =
            result.rows?._array
              ?.map((r: { id: string }) => r.id)
              .filter(Boolean) ?? [];
          onUpdate(ids);
        }
      }
    );
  }

  async newAttachmentRecord(
    record?: Partial<AttachmentRecord>
  ): Promise<AttachmentRecord> {
    const id = record?.id ?? '';
    const pericopeId = id.split('__')[1] ?? id;

    return {
      id,
      filename: `${id}.json`,
      local_uri: pericopeCacheLocalUri(pericopeId),
      media_type: 'application/json',
      state: AttachmentState.QUEUED_DOWNLOAD,
      timestamp: Date.now()
    };
  }

  async downloadRecord(record: AttachmentRecord): Promise<boolean> {
    const separatorIdx = record.id.indexOf('__');
    if (separatorIdx === -1) {
      console.error(`[FIA Queue] Invalid attachment ID format: ${record.id}`);
      return false;
    }

    const projectId = record.id.substring(0, separatorIdx);
    const pericopeId = record.id.substring(separatorIdx + 2);

    const cached = await getCachedFiaPericope(pericopeId);
    if (cached) {
      await this.update({ ...record, state: AttachmentState.SYNCED });
      return true;
    }

    try {
      const session =
        await this.supabaseConnector.client.auth.getSession();
      const token = session.data.session?.access_token;

      await fetchAndCacheFiaPericope(projectId, pericopeId, token);
      await this.update({ ...record, state: AttachmentState.SYNCED });
      console.log(`[FIA Queue] Downloaded: ${record.id}`);
      return true;
    } catch (e) {
      if (this.options.onDownloadError) {
        const { retry } = await this.options.onDownloadError(record, e);
        if (!retry) {
          await this.update({ ...record, state: AttachmentState.ARCHIVED });
          return true;
        }
      }
      console.error(`[FIA Queue] Download failed for ${record.id}:`, e);
      return false;
    }
  }

  async delete(record: AttachmentRecord, tx?: Transaction): Promise<void> {
    const deleteRecord = async (writeTx: Transaction) => {
      await writeTx.execute(`DELETE FROM ${this.table} WHERE id = ?`, [
        record.id
      ]);
    };

    if (tx) {
      await deleteRecord(tx);
    } else {
      await this.powersync.writeTransaction(deleteRecord);
    }

    const pericopeId = record.id.split('__')[1];
    if (pericopeId) {
      deleteFiaPericopeCache(pericopeId);
    }
  }
}
