import {
  // AbstractAttachmentQueue,
  AttachmentQueueOptions,
  AttachmentRecord,
  AttachmentState
} from '@powersync/attachments';
import { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as drizzleSchema from '../drizzleSchema';
import { isNotNull, eq, and } from 'drizzle-orm';
// import { system } from '../powersync/system';
import { AppConfig } from '../supabase/AppConfig';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';

export class TempAttachmentQueue extends AbstractSharedAttachmentQueue {
  private _onUpdateCallback: ((ids: string[]) => void) | null = null;

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
      // maxCacheSize?: number;
    }
  ) {
    super({
      ...options,
      cacheLimit: options.cacheLimit || 50 // Default to 50 if not specified
    });
  }

  // Implement the abstract method to identify this queue's storage type
  getStorageType(): 'permanent' | 'temporary' {
    return 'temporary';
  }

  async init() {
    console.log('TempAttachmentQueue init entered...');
    if (!AppConfig.supabaseBucket) {
      console.debug(
        'No Supabase bucket configured, skip setting up TempAttachmentQueue.'
      );
      // Disable sync interval to prevent errors from trying to sync to a non-existent bucket
      this.options.syncInterval = 0;
      return;
    }

    await super.init();
  }

  // Helper method to get the current user's ID
  // async getCurrentUserId(): Promise<string | null> {
  //   try {
  //     const {
  //       data: { session }
  //     } = await system.supabaseConnector.client.auth.getSession();
  //     return session?.user?.id || null;
  //   } catch (error) {
  //     console.error('[TEMP QUEUE] Error getting current user ID:', error);
  //     return null;
  //   }
  // }

  // Modified to store the callback and initialize empty list
  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    console.log('[TEMP QUEUE] Setting onAttachmentIdsChange callback');
    this._onUpdateCallback = onUpdate;

    // Initialize with empty list
    onUpdate([]);
  }

  // Simple method to load attachments for an asset
  async loadAssetAttachments(assetId: string): Promise<void> {
    console.log(`[TEMP QUEUE] Loading attachments for asset: ${assetId}`);
    const attachmentIds = await this.getAllAssetAttachments(assetId);
    if (this._onUpdateCallback) {
      this._onUpdateCallback(attachmentIds);
    }
  }

  // Override expireCache to only count temporary attachments
  async expireCache(): Promise<void> {
    console.log('[TEMP QUEUE] Running expireCache');

    // Get all temporary attachments sorted by timestamp (descending)
    const allTempAttachments = await this.powersync.getAll<AttachmentRecord>(
      `SELECT * FROM ${this.table} 
       WHERE storage_type = 'temporary'
       ORDER BY timestamp DESC`
    );

    const cacheLimit = this.options.cacheLimit ?? 50; // Default to 50 if undefined

    console.log(
      `[TEMP QUEUE] Max cache size: ${cacheLimit}, current size: ${allTempAttachments.length}`
    );

    if (allTempAttachments.length > cacheLimit) {
      const attachmentsToDelete = allTempAttachments.slice(cacheLimit);

      console.log(
        `[TEMP QUEUE] Expiring ${attachmentsToDelete.length} temporary attachments`
      );

      // Delete the oldest attachments
      await this.powersync.writeTransaction(async (tx) => {
        for (const record of attachmentsToDelete) {
          console.log(`[TEMP QUEUE] Deleting attachment: ${record.id}`);
          await this.delete(record, tx);
        }
      });
    }
  }

  async deleteFromQueue(attachmentId: string): Promise<void> {
    const record = await this.record(attachmentId);
    if (record) {
      await this.delete(record);
    }
  }

  async newAttachmentRecord(
    record?: Partial<AttachmentRecord>
  ): Promise<AttachmentRecord> {
    const photoId = record?.id ?? randomUUID();
    return {
      state: AttachmentState.QUEUED_UPLOAD,
      id: photoId,
      filename: photoId,
      ...record
    };
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    const photoAttachment = await this.newAttachmentRecord();
    photoAttachment.local_uri = this.getLocalFilePathSuffix(
      photoAttachment.filename
    );
    const localUri = this.getLocalUri(photoAttachment.local_uri);
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
    const audioAttachment = await this.newAttachmentRecord({
      media_type: 'audio/mpeg'
    });
    audioAttachment.local_uri = this.getLocalFilePathSuffix(
      audioAttachment.filename
    );
    const localUri = this.getLocalUri(audioAttachment.local_uri);
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
}
