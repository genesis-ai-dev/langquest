import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import { AttachmentState } from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import * as FileSystem from 'expo-file-system';
import type * as drizzleSchema from '../drizzleSchema';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';
import { AttachmentStateManager } from './AttachmentStateManager';

export class PermAttachmentQueue extends AbstractSharedAttachmentQueue {
  // Use unified attachment state manager instead of local state
  private attachmentStateManager: AttachmentStateManager;

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
    }
  ) {
    super(options);
    this.attachmentStateManager = new AttachmentStateManager(this.db);
  }

  getStorageType(): 'permanent' | 'temporary' {
    return 'permanent';
  }

  async init() {
    await super.init();
    console.log('[PERM QUEUE] ✅ Initialized with unified attachment state manager');
  }

  // Remove the old collectAllAttachmentIds method since we're using AttachmentStateManager
  // Remove the old updateAttachmentIds method since we're using AttachmentStateManager

  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    console.log('[PERM QUEUE] Setting up unified attachment watcher with AttachmentStateManager');

    // Single coordinated watcher using AttachmentStateManager
    const updateWithSource = (source: string) => {
      void this.attachmentStateManager.updateWithDebounce(onUpdate, source);
    };

    // Watch for changes in downloaded assets (direct downloads)
    this.db.watch(
      this.db.query.asset.findMany({
        columns: { id: true, download_profiles: true, images: true }
      }),
      {
        onResult: () => {
          console.log('[PERM QUEUE] Asset downloads changed, updating attachments via state manager');
          void updateWithSource('asset_downloads');
        }
      }
    );

    // Watch for changes in downloaded quests (quest downloads)
    this.db.watch(
      this.db.query.quest.findMany({
        columns: { id: true, download_profiles: true }
      }),
      {
        onResult: () => {
          console.log('[PERM QUEUE] Quest downloads changed, updating attachments via state manager');
          void updateWithSource('quest_downloads');
        }
      }
    );

    // Watch for changes in quest-asset links (affects which assets are in downloaded quests)
    this.db.watch(
      this.db.query.quest_asset_link.findMany({
        columns: { quest_id: true, asset_id: true }
      }),
      {
        onResult: () => {
          console.log('[PERM QUEUE] Quest-asset links changed, updating attachments via state manager');
          void updateWithSource('quest_asset_links');
        }
      }
    );

    // Watch for changes in asset content links (affects downloaded assets)
    this.db.watch(
      this.db.query.asset_content_link.findMany({
        columns: { asset_id: true, audio_id: true }
      }),
      {
        onResult: () => {
          console.log('[PERM QUEUE] Asset content changed, updating attachments via state manager');
          void updateWithSource('asset_content');
        }
      }
    );

    // Watch for changes in translations (affects downloaded assets)
    this.db.watch(
      this.db.query.translation.findMany({
        columns: { asset_id: true, audio: true }
      }),
      {
        onResult: () => {
          console.log('[PERM QUEUE] Translations changed, updating attachments via state manager');
          void updateWithSource('translations');
        }
      }
    );

    // Initial load
    console.log('[PERM QUEUE] Running initial attachment ID collection via state manager');
    void updateWithSource('initial_load');
  }

  async deleteFromQueue(attachmentId: string): Promise<void> {
    const record = await this.record(attachmentId);
    if (record) {
      await this.delete(record);
    }
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    const photoAttachment = await this.newAttachmentRecord();
    const localUri = this.getLocalUri(photoAttachment.local_uri!);
    await this.storage.writeFile(localUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64
    });

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      photoAttachment.size = fileInfo.size;
    }

    return this.saveToQueue(photoAttachment);
  }

  async saveAudio(tempUri: string): Promise<AttachmentRecord> {
    const extension = tempUri.split('.').pop();
    const audioAttachment = await this.newAttachmentRecord(
      {
        media_type: 'audio/mpeg'
      },
      extension
    );
    const localUri = this.getLocalUri(audioAttachment.local_uri!);
    await FileSystem.moveAsync({
      from: tempUri,
      to: localUri
    });

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      audioAttachment.size = fileInfo.size;
    }

    return this.saveToQueue(audioAttachment);
  }

  async expireCache() {
    const res = await this.powersync
      .getAll<AttachmentRecord>(`SELECT * FROM ${this.table}
          WHERE
           state = ${AttachmentState.ARCHIVED} AND storage_type = 'permanent'
         ORDER BY
           timestamp DESC
         LIMIT 100`);

    if (res.length == 0) {
      return;
    }

    console.debug(`Deleting ${res.length} permanent attachments`);

    await this.powersync.writeTransaction(async (tx) => {
      for (const record of res) {
        await this.delete(record, tx);
      }
    });
  }

  // Get debug info from the attachment state manager
  getDebugInfo() {
    return this.attachmentStateManager.getDebugInfo();
  }

  // Cleanup method
  destroy() {
    this.attachmentStateManager.destroy();
  }
}
