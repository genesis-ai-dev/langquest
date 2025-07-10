import { getAssetAudioContent, getAssetById } from '@/hooks/db/useAssets';
import { getTranslationsByAssetId } from '@/hooks/db/useTranslations';
import { useLocalStore } from '@/store/localStore';
import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import {
  AbstractAttachmentQueue,
  AttachmentState
} from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { randomUUID } from 'expo-crypto';
import type * as drizzleSchema from '../drizzleSchema';

// Extended interface that includes our storage_type field
export interface ExtendedAttachmentRecord extends AttachmentRecord {
  storage_type: 'permanent' | 'temporary';
}

export abstract class AbstractSharedAttachmentQueue extends AbstractAttachmentQueue {
  // Common directory for all attachments
  static SHARED_DIRECTORY = 'shared_attachments';
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor(
    options: Omit<
      AttachmentQueueOptions,
      'onDownloadError' | 'onUploadError'
    > & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
    }
  ) {
    super({
      ...options,
      performInitialSync: false
    });
    this.db = options.db;
  }

  async init() {
    // Make sure initialSync is always false before calling parent init
    this.initialSync = false;
    await super.init();
  }

  // eslint-disable-next-line
  async newAttachmentRecord(
    record?: Partial<AttachmentRecord>,
    extension?: string
  ): Promise<AttachmentRecord> {
    const photoId = record?.id ?? randomUUID();
    const filename =
      record?.filename ?? `${photoId}${extension ? `.${extension}` : ''}`;
    // const filenameWithoutPath = filename.split('/').pop() ?? filename;
    const localUri = this.getLocalFilePathSuffix(filename);
    return {
      state: AttachmentState.QUEUED_UPLOAD,
      id: filename,
      filename: filename,
      local_uri: localUri,
      ...record
    };
  }

  // eslint-disable-next-line
  async watchAttachmentIds() {
    this.onAttachmentIdsChange((ids) => {
      void (async () => {
        const _ids = `${ids.map((id) => `'${id}'`).join(',')}`;

        if (this.initialSync) {
          this.initialSync = false;
          // Mark AttachmentIds for sync
          await this.powersync.execute(
            `UPDATE
                ${this.table}
              SET state = ${AttachmentState.QUEUED_SYNC}
              WHERE
                state < ${AttachmentState.SYNCED}
              AND
               id IN (${_ids})`
          );
        }

        const attachmentsInDatabase =
          await this.powersync.getAll<ExtendedAttachmentRecord>(
            `SELECT * FROM ${this.table} WHERE state < ${AttachmentState.ARCHIVED}`
          );

        const storageType = this.getStorageType();

        for (const id of ids) {
          const record = attachmentsInDatabase.find((r) => r.id == id);
          // 1. ID is not in the database
          if (!record) {
            const newRecord = await this.newAttachmentRecord({
              id: id,
              state: AttachmentState.QUEUED_SYNC
            });
            await this.saveToQueue(newRecord);
          } else if (
            // 2. Attachment exists but needs to be converted to permanent
            storageType === 'permanent' &&
            record.storage_type === 'temporary'
          ) {
            await this.update({
              ...record,
              state: AttachmentState.QUEUED_SYNC,
              storage_type: 'permanent'
            });
          } else if (
            record.local_uri == null ||
            !(await this.storage.fileExists(this.getLocalUri(record.local_uri)))
          ) {
            // 3. Attachment in database but no local file, mark as queued download
            await this.update({
              ...record,
              state: AttachmentState.QUEUED_DOWNLOAD
            });
          }
        }

        // 3. Handle archiving based on storage type
        // const storageType = this.getStorageType();
        // if (storageType === 'temporary') {
        //   // For temporary attachments, only archive other temporary attachments that are SYNCED
        //   await this.powersync.execute(
        //     `UPDATE ${this.table}
        //       SET state = ${AttachmentState.ARCHIVED}
        //       WHERE
        //         state = ${AttachmentState.SYNCED}
        //         AND storage_type = 'temporary'
        //         AND id NOT IN (${ids.map((id) => `'${id}'`).join(',')})`
        //   );
        // }

        // Handle archiving of permanent attachments
        if (storageType === 'permanent') {
          // For permanent attachments, only archive other permanent attachments that are SYNCED
          await this.powersync.execute(
            `UPDATE ${this.table}
            SET state = ${AttachmentState.ARCHIVED}
            WHERE
              state = ${AttachmentState.SYNCED}
              AND storage_type = 'permanent'
                AND id NOT IN (${ids.map((id) => `'${id}'`).join(',')})`
          );
        }
      })();
    });
  }

  // Override getLocalFilePathSuffix to use shared directory
  getLocalFilePathSuffix(filename: string): string {
    return `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${filename}`;
  }

  // Override saveToQueue to add storage_type (using type assertion for compatibility)
  async saveToQueue(
    record: Omit<AttachmentRecord, 'timestamp'>
  ): Promise<AttachmentRecord> {
    const updatedRecord: AttachmentRecord = {
      ...record,
      timestamp: new Date().getTime()
    };

    // Add storage_type to the record
    const storageType = this.getStorageType();

    await this.powersync.execute(
      `INSERT OR REPLACE INTO ${this.table} 
       (id, timestamp, filename, local_uri, media_type, size, state, storage_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        updatedRecord.id,
        updatedRecord.timestamp,
        updatedRecord.filename,
        updatedRecord.local_uri ?? null,
        updatedRecord.media_type ?? null,
        updatedRecord.size ?? null,
        updatedRecord.state,
        storageType
      ]
    );

    // Return the record with storage_type (using type assertion for compatibility)
    // The parent class expects AttachmentRecord, but we've actually added the storage_type
    return updatedRecord;
  }

  // Helper method to get full record with storage_type
  async getExtendedRecord(
    id: string
  ): Promise<ExtendedAttachmentRecord | null> {
    return this.powersync.getOptional<ExtendedAttachmentRecord>(
      `SELECT * FROM ${this.table} WHERE id = ?`,
      [id]
    );
  }

  // Override update method to preserve storage_type
  async update(
    record: Omit<ExtendedAttachmentRecord, 'timestamp'>
  ): Promise<void> {
    const timestamp = new Date().getTime();

    // Get existing record to retrieve storage_type if not provided
    const existingRecord =
      await this.powersync.getOptional<ExtendedAttachmentRecord>(
        `SELECT * FROM ${this.table} WHERE id = ?`,
        [record.id]
      );

    const storageType = existingRecord
      ? existingRecord.storage_type
      : record.storage_type;

    await this.powersync.execute(
      `UPDATE ${this.table}
       SET timestamp = ?,
           filename = ?,
           local_uri = ?,
           size = ?,
           media_type = ?,
           state = ?,
           storage_type = ?
       WHERE id = ?`,
      [
        timestamp,
        record.filename,
        record.local_uri ?? null,
        record.size,
        record.media_type,
        record.state,
        storageType,
        record.id
      ]
    );
  }

  // Abstract method to be implemented by subclasses
  abstract getStorageType(): 'permanent' | 'temporary';

  async record(id: string): Promise<AttachmentRecord | null> {
    return this.powersync.getOptional<ExtendedAttachmentRecord>(
      `SELECT * FROM ${this.table} WHERE id = ? AND storage_type = ?`,
      [id, this.getStorageType()]
    );
  }

  // Common method to identify all attachments related to an asset
  async getAllAssetAttachments(assetId: string): Promise<string[]> {
    // const queueType =
    //   this.getStorageType() === 'temporary' ? '[TEMP QUEUE]' : '[PERM QUEUE]';
    // console.log(`${queueType} Finding all attachments for asset: ${assetId}`);
    const attachmentIds: string[] = [];

    try {
      // 1. Get the asset itself for images
      const asset = await getAssetById(assetId);

      if (asset?.images) {
        // console.log(
        //   `${queueType} Found ${asset.images.length} images in asset`
        // );
        attachmentIds.push(...asset.images);
      }

      // 2. Get asset_content_link entries for audio
      const assetContents = await getAssetAudioContent(assetId);

      const contentAudioIds = assetContents
        ?.filter((content) => content.audio_id)
        .map((content) => content.audio_id!);

      if (contentAudioIds?.length) {
        // console.log(
        //   `${queueType} Found ${contentAudioIds.length} audio files in asset_content_link`
        // );
        attachmentIds.push(...contentAudioIds);
      }

      // 3. Get translations for the asset and their audio
      const translations = await getTranslationsByAssetId(assetId);

      const translationAudioIds = translations
        ?.filter((translation) => translation.audio)
        .map((translation) => translation.audio!);

      if (translationAudioIds?.length) {
        // console.log(
        //   `${queueType} Found ${translationAudioIds.length} audio files in translations`
        // );
        attachmentIds.push(...translationAudioIds);
      }

      // Log all found attachments
      // console.log(
      //   `${queueType} Total attachments for asset ${assetId}: ${attachmentIds.length}`
      // );

      return attachmentIds;
    } catch {
      // console.error(
      //   `${queueType} Error getting attachments for asset ${assetId}:`,
      //   error
      // );
      return [];
    }
  }

  // Override downloadRecords to track progress
  async downloadRecordsWithProgress() {
    if (!this.options.downloadAttachments) {
      return;
    }
    if (this.downloading) {
      return;
    }
    const idsToDownload = await this.getIdsToDownload();
    idsToDownload.forEach((id) => this.downloadQueue.add(id));

    if (this.downloadQueue.size === 0) {
      return;
    }

    this.downloading = true;
    const totalToDownload = this.downloadQueue.size;
    let downloaded = 0;

    // Update store with download starting
    useLocalStore.getState().setAttachmentSyncProgress({
      downloading: true,
      downloadCurrent: 0,
      downloadTotal: totalToDownload
    });

    try {
      console.log(`Downloading ${this.downloadQueue.size} attachments...`);

      // Convert downloadQueue to array for concurrent processing
      const idsArray = Array.from(this.downloadQueue);
      this.downloadQueue.clear();

      // Create a progress update function that's thread-safe
      const updateProgress = () => {
        downloaded++;
        useLocalStore.getState().setAttachmentSyncProgress({
          downloadCurrent: downloaded,
          downloadTotal: totalToDownload
        });
      };

      // Download with higher concurrency limit (8 simultaneous downloads)
      const CONCURRENCY_LIMIT = 8;

      // Create a queue-based concurrent download system
      const downloadQueue = [...idsArray];
      const downloadPromises: Promise<void>[] = [];

      const processDownload = async (id: string): Promise<void> => {
        try {
          const record = await this.record(id);
          if (!record) {
            updateProgress(); // Count as completed even if no record
            return;
          }
          await this.downloadRecord(record);
          updateProgress(); // Update progress after successful download
        } catch (error) {
          console.error(`Failed to download attachment ${id}:`, error);
          updateProgress(); // Count as completed even if failed
        } finally {
          // Start next download if queue not empty
          if (downloadQueue.length > 0) {
            const nextId = downloadQueue.shift()!;
            downloadPromises.push(processDownload(nextId));
          }
        }
      };

      // Start initial batch of downloads
      const initialBatch = downloadQueue.splice(0, CONCURRENCY_LIMIT);

      for (const id of initialBatch) {
        downloadPromises.push(processDownload(id));
      }

      // Wait for all downloads to complete
      await Promise.allSettled(downloadPromises);

      console.log('Finished downloading attachments');
    } catch (e) {
      console.log('Downloads failed:', e);
    } finally {
      this.downloading = false;
      // Reset download status
      useLocalStore.getState().setAttachmentSyncProgress({
        downloading: false
      });
    }
  }

  // Override uploadRecords to track progress
  async uploadRecordsWithProgress() {
    if (this.uploading) {
      return;
    }
    this.uploading = true;

    try {
      // Get count of records to upload
      const uploadCount = await this.powersync.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${this.table} WHERE local_uri IS NOT NULL AND (state = ${AttachmentState.QUEUED_UPLOAD} OR state = ${AttachmentState.QUEUED_SYNC})`
      );

      const totalToUpload = uploadCount.count;
      let uploaded = 0;

      if (totalToUpload > 0) {
        // Update store with upload starting
        useLocalStore.getState().setAttachmentSyncProgress({
          uploading: true,
          uploadCurrent: 0,
          uploadTotal: totalToUpload
        });
      }

      let record = await this.getNextUploadRecord();
      if (!record) {
        return;
      }

      console.log(`Uploading attachments...`);
      while (record) {
        const uploadedSuccessfully = await this.uploadAttachment(record);
        if (!uploadedSuccessfully) {
          // Then attachment failed to upload. We try all uploads when the next trigger() is called
          break;
        }
        uploaded++;

        // Update progress
        useLocalStore.getState().setAttachmentSyncProgress({
          uploadCurrent: uploaded,
          uploadTotal: totalToUpload
        });

        record = await this.getNextUploadRecord();
      }
      console.log('Finished uploading attachments');
    } catch (error) {
      console.log('Upload failed:', error);
    } finally {
      this.uploading = false;
      // Reset upload status
      useLocalStore.getState().setAttachmentSyncProgress({
        uploading: false
      });
    }
  }

  // Override trigger to use our progress-tracking methods
  trigger() {
    void this.uploadRecordsWithProgress();
    void this.downloadRecordsWithProgress();
    void this.expireCache();
  }

  // Override watchDownloads to use our progress-tracking method
  watchDownloads() {
    if (!this.options.downloadAttachments) {
      return;
    }
    this.idsToDownload((ids) => {
      ids.forEach((id) => this.downloadQueue.add(id));
      // Use our progress-tracking method
      void this.downloadRecordsWithProgress();
    });
  }

  // Override watchUploads to use our progress-tracking method
  watchUploads() {
    this.idsToUpload((ids) => {
      if (ids.length > 0) {
        // Use our progress-tracking method
        void this.uploadRecordsWithProgress();
      }
    });
  }
}
