import { useLocalStore } from '@/store/localStore';
import {
  cacheBibleText,
  downloadBibleAudio,
  isBibleAudioCached,
  isBibleTextCached
} from '@/utils/bible-cache';
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

  /**
   * Syncs bible content for the user's saved translation alongside FIA guide content.
   * Reads the saved translation from localStore and queries quest metadata for verse range.
   */
  private async syncBibleContent(
    projectId: string,
    pericopeId: string,
    token: string | undefined
  ): Promise<void> {
    const savedBible =
      useLocalStore.getState().bibleTranslationByProject[projectId];
    if (!savedBible?.textFilesetId) return;

    const questMeta = await this.powersync.getAll<{
      verseRange: string;
      bookId: string;
    }>(
      `SELECT json_extract(metadata, '$.fia.verseRange') as verseRange,
              json_extract(metadata, '$.fia.bookId') as bookId
       FROM quest_synced
       WHERE json_extract(metadata, '$.fia.pericopeId') = ?
       UNION
       SELECT json_extract(metadata, '$.fia.verseRange') as verseRange,
              json_extract(metadata, '$.fia.bookId') as bookId
       FROM quest_local
       WHERE json_extract(metadata, '$.fia.pericopeId') = ?
       LIMIT 1`,
      [pericopeId, pericopeId]
    );

    const meta = questMeta[0];
    if (!meta?.verseRange || !meta?.bookId) return;

    const bookId = meta.bookId.toUpperCase();
    const verseRange = meta.verseRange;

    if (isBibleTextCached(savedBible.textFilesetId, bookId, verseRange)) {
      return;
    }

    const match = verseRange.match(
      /^(\d+):(\d+)[a-z]?-(?:(\d+):)?(\d+)[a-z]?$/
    );
    if (!match) return;

    const parsed = {
      startChapter: parseInt(match[1]!, 10),
      startVerse: parseInt(match[2]!, 10),
      endChapter: match[3] ? parseInt(match[3], 10) : parseInt(match[1]!, 10),
      endVerse: parseInt(match[4]!, 10)
    };

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/bible-brain-content`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? anonKey}`
        },
        body: JSON.stringify({
          action: 'get-content',
          textFilesetId: savedBible.textFilesetId,
          audioFilesetId: savedBible.audioFilesetId,
          bookId,
          startChapter: parsed.startChapter,
          startVerse: parsed.startVerse,
          endChapter: parsed.endChapter,
          endVerse: parsed.endVerse
        })
      }
    );

    if (!response.ok) return;

    const data = await response.json();

    if (savedBible.textFilesetId && data.verses?.length > 0) {
      await cacheBibleText(savedBible.textFilesetId, bookId, verseRange, data);
    }

    if (
      savedBible.audioFilesetId &&
      data.audio?.length > 0 &&
      !isBibleAudioCached(savedBible.audioFilesetId, bookId, verseRange)
    ) {
      await downloadBibleAudio(
        savedBible.audioFilesetId,
        bookId,
        verseRange,
        data.audio
      );
    }

    console.log(
      `[FIA Queue] Bible content synced for ${pericopeId} (${savedBible.textFilesetId})`
    );
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
      // FIA guide is cached — still try to sync bible content
      try {
        const session = await this.supabaseConnector.client.auth.getSession();
        await this.syncBibleContent(
          projectId,
          pericopeId,
          session.data.session?.access_token
        );
      } catch (e) {
        console.warn(`[FIA Queue] Bible sync failed for ${pericopeId}:`, e);
      }
      await this.update({ ...record, state: AttachmentState.SYNCED });
      return true;
    }

    try {
      const session = await this.supabaseConnector.client.auth.getSession();
      const token = session.data.session?.access_token;

      await fetchAndCacheFiaPericope(projectId, pericopeId, token);

      // Also download bible content for the user's saved translation
      try {
        await this.syncBibleContent(projectId, pericopeId, token);
      } catch (e) {
        console.warn(`[FIA Queue] Bible sync failed for ${pericopeId}:`, e);
      }

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
