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
import { system } from '../powersync/system';
import { AppConfig } from '../supabase/AppConfig';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';

export class TempAttachmentQueue extends AbstractSharedAttachmentQueue {
  private tempAssetIds: Set<string> = new Set();
  private lastAccessedAssets: string[] = []; // For FIFO tracking
  private maxCacheSize: number;
  private _onUpdateCallback: ((ids: string[]) => void) | null = null;

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
      maxCacheSize?: number;
    }
  ) {
    super(options);
    // this.db = options.db;
    this.maxCacheSize = options.maxCacheSize || 50; // Default to 50 if not specified
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
  async getCurrentUserId(): Promise<string | null> {
    try {
      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('[TEMP QUEUE] Error getting current user ID:', error);
      return null;
    }
  }

  // Modified to store the callback and initialize empty list
  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    console.log('[TEMP QUEUE] Setting onAttachmentIdsChange callback');
    this._onUpdateCallback = onUpdate;

    // Initialize with empty list (will be populated by addTempAsset calls)
    onUpdate([]);
  }

  // Add a temporary asset to the queue
  async addTempAsset(assetId: string): Promise<void> {
    console.log(`[TEMP QUEUE] Adding temporary asset ${assetId}`);

    // Add to tracking set
    this.tempAssetIds.add(assetId);

    // Update the FIFO queue (remove old assetId if it exists)
    this.lastAccessedAssets = this.lastAccessedAssets.filter(
      (id) => id !== assetId
    );
    // Add new assetId back, but to the end of the queue
    this.lastAccessedAssets.push(assetId);

    // Enforce cache size limit
    await this.enforceCacheLimit();

    // Refresh the attachments for all temp assets
    await this.refreshTempAttachments();
  }

  // Refresh attachments for all temporary assets
  private async refreshTempAttachments(): Promise<void> {
    console.log('[TEMP QUEUE] Refreshing temporary attachments');

    if (this.tempAssetIds.size === 0) {
      // If no temp assets, clear the queue
      if (this._onUpdateCallback) {
        this._onUpdateCallback([]);
      }
      return;
    }

    // Get all attachment IDs for temp assets
    const allAttachmentIds: string[] = [];

    for (const assetId of this.tempAssetIds) {
      const assetAttachments = await this.getAllAssetAttachments(assetId);
      allAttachmentIds.push(...assetAttachments);
    }

    console.log(
      `[TEMP QUEUE] Found ${allAttachmentIds.length} attachments for temporary assets`
    );

    // Remove duplicates
    const uniqueAttachmentIds = [...new Set(allAttachmentIds)];

    // Update the queue with these IDs
    if (this._onUpdateCallback) {
      this._onUpdateCallback(uniqueAttachmentIds);
    }
  }

  // Override the original trigger method to ensure more frequent checks for temp queue
  trigger() {
    // Call parent trigger first
    super.trigger();

    // Also explicitly check for cache expiration
    this.expireCache().catch((error) => {
      console.error(
        '[TEMP QUEUE] Error during explicit cache expiration:',
        error
      );
    });
  }

  // Override expireCache to only count temporary attachments
  async expireCache(): Promise<void> {
    console.log('[TEMP QUEUE] Running expireCache');

    // Get all attachments to log their field values
    const allAttachments = await this.powersync.getAll<AttachmentRecord>(
      `SELECT * FROM ${this.table}`
    );

    console.log('[TEMP QUEUE] All attachments in database:');
    allAttachments.forEach((attachment) => {
      console.log(JSON.stringify(attachment, null, 2));
    });

    // Get all temporary attachments sorted by timestamp (descending)
    const allTempAttachments = await this.powersync.getAll<AttachmentRecord>(
      `SELECT * FROM ${this.table} 
       ORDER BY timestamp DESC`
    );

    // `SELECT * FROM ${this.table}
    //    WHERE storage_type = 'temporary' AND (state = ? OR state = ?)
    //    ORDER BY timestamp DESC`,
    //   [AttachmentState.SYNCED, AttachmentState.ARCHIVED]

    console.log('[TEMP QUEUE] Retrieved temporary attachments:');
    console.log(JSON.stringify(allTempAttachments, null, 2));

    // If we have more than maxCacheSize, delete the oldest ones
    //log max cache size
    console.log(
      `[TEMP QUEUE] Max cache size: ${this.maxCacheSize}, current size: ${allTempAttachments.length}`
    );
    if (allTempAttachments.length > this.maxCacheSize) {
      const attachmentsToDelete = allTempAttachments.slice(this.maxCacheSize);

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

  // Enforce the cache size limit using FIFO
  private async enforceCacheLimit(): Promise<void> {
    if (this.lastAccessedAssets.length <= this.maxCacheSize) {
      return;
    }

    console.log(
      `[TEMP QUEUE] Enforcing cache limit, current size: ${this.lastAccessedAssets.length}, max: ${this.maxCacheSize}`
    );

    // Remove oldest assets until we're within the limit
    while (this.lastAccessedAssets.length > this.maxCacheSize) {
      const oldestAssetId = this.lastAccessedAssets.shift();
      if (oldestAssetId) {
        console.log(`[TEMP QUEUE] Removing oldest asset: ${oldestAssetId}`);
        this.tempAssetIds.delete(oldestAssetId);
      }
    }

    // After enforcing the limit, refresh attachments
    await this.refreshTempAttachments();

    // Explicitly call expireCache to remove attachments from database and storage
    await this.expireCache();
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
