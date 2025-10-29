import { useLocalStore } from '@/store/localStore';
import { toColumns } from '@/utils/dbUtils';
import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import {
  AbstractAttachmentQueue,
  AttachmentState
} from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import BiMap from 'bidirectional-map';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import type * as drizzleSchema from '../drizzleSchema';
import {
  asset_content_link_synced,
  asset_synced
} from '../drizzleSchemaSynced';

// Extended interface that includes our storage_type field
export interface ExtendedAttachmentRecord extends AttachmentRecord {
  storage_type: 'permanent' | 'temporary';
}

export abstract class AbstractSharedAttachmentQueue extends AbstractAttachmentQueue {
  // Common directory for all attachments
  static SHARED_DIRECTORY = 'shared_attachments';
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  private downloadAccumulationTimer: ReturnType<typeof setTimeout> | null =
    null;
  private uploadAccumulationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DOWNLOAD_BATCH_DELAY_MS = 500; // Wait 500ms to accumulate downloads (very snappy)
  private readonly UPLOAD_BATCH_DELAY_MS = 5000; // Wait 5s to accumulate uploads (longer to reduce spam)

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
    record?: Partial<AttachmentRecord>
  ): Promise<AttachmentRecord> {
    // CRITICAL: Silently skip blob URLs - they're filtered upstream but check defensively
    if (
      record?.id?.includes('blob:') ||
      record?.local_uri?.includes('blob:') ||
      record?.filename?.includes('blob:')
    ) {
      console.warn(
        '[AttachmentQueue] Skipping blob URL (filtered):',
        record?.id?.substring(0, 30)
      );
      // Return a dummy rejected record that won't be processed
      return {
        id: '',
        filename: '',
        local_uri: '',
        state: AttachmentState.ARCHIVED,
        media_type: '',
        timestamp: 0
      } as AttachmentRecord;
    }

    // When downloading existing attachments, use the provided ID directly
    // if (record?.id && record.state === AttachmentState.QUEUED_SYNC) {
    //   console.log('downloading attachment', record);
    //   // Validate that the ID is not empty
    //   if (!record.id.trim()) {
    //     throw new Error('Attachment ID cannot be empty');
    //   }
    //   const localUri = this.getLocalFilePathSuffix(record.id);
    //   return {
    //     ...record,
    //     filename: record.id,
    //     local_uri: localUri,
    //     timestamp: new Date().getTime()
    //   } as AttachmentRecord;
    // }

    const mediaType = record?.media_type
      ? record.media_type
      : this.getMediaTypeFromExtension(record?.id?.split('.').pop());
    const extension = this.getExtensionFromMediaType(mediaType);

    // For new uploads, generate a new ID
    const recordId = record?.id ?? uuid.v4();
    const filename = recordId.endsWith(extension)
      ? recordId
      : `${recordId}.${extension}`;
    const localUri = this.getLocalFilePathSuffix(filename);

    // Final validation - ensure no blob URLs slipped through
    if (
      filename.includes('blob:') ||
      localUri.includes('blob:') ||
      recordId.includes('blob:')
    ) {
      console.error('[AttachmentQueue] Generated record contains blob URL:', {
        recordId,
        filename,
        localUri
      });
      throw new Error(
        'Generated attachment record contains blob URL. This should never happen.'
      );
    }

    return {
      ...record,
      state: record?.state ?? AttachmentState.QUEUED_UPLOAD,
      id: filename,
      filename: filename,
      local_uri: localUri,
      media_type: mediaType,
      timestamp: new Date().getTime()
    } as AttachmentRecord;
  }

  // eslint-disable-next-line
  async watchAttachmentIds() {
    this.onAttachmentIdsChange((ids) => {
      void (async () => {
        try {
          // Filter out empty or invalid IDs
          const validIds = ids.filter((id) => id && id.trim() !== '');
          if (validIds.length !== ids.length) {
            console.warn(
              `[WATCH IDS] Filtered out ${ids.length - validIds.length} empty/invalid IDs`
            );
          }

          // Use validIds from here on
          ids = validIds;

          // Process in smaller batches to avoid SQL query size limits
          const BATCH_SIZE = 500;

          if (this.initialSync) {
            this.initialSync = false;

            // Update in batches
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
              const batchIds = ids.slice(i, i + BATCH_SIZE);
              const _batchIds = `${batchIds.map((id) => `'${id}'`).join(',')}`;

              await this.powersync.execute(
                `UPDATE
                    ${this.table}
                  SET state = ${AttachmentState.QUEUED_SYNC}
                  WHERE
                    state < ${AttachmentState.SYNCED}
                  AND
                   id IN (${_batchIds})`
              );
            }
          }

          const attachmentsInDatabase =
            await this.powersync.getAll<ExtendedAttachmentRecord>(
              `SELECT * FROM ${this.table} WHERE state < ${AttachmentState.ARCHIVED}`
            );

          const storageType = this.getStorageType();

          let added = 0;
          let updatedToDownload = 0;
          let convertedToPermanent = 0;
          let skipped = 0;
          let errors = 0;

          // Process each attachment ID with error handling
          for (const id of ids) {
            try {
              const record = attachmentsInDatabase.find((r) => r.id == id);

              if (!record) {
                const newRecord = await this.newAttachmentRecord({
                  id: id,
                  state: AttachmentState.QUEUED_SYNC
                });

                // Validate the record before saving
                if (!newRecord.id || !newRecord.filename) {
                  console.error(
                    `[WATCH IDS] Invalid record created for ${id}:`,
                    newRecord
                  );
                  errors++;
                  continue;
                }

                await this.saveToQueue(newRecord);
                added++;
              } else if (
                storageType === 'permanent' &&
                record.storage_type === 'temporary'
              ) {
                await this.update({
                  ...record,
                  state: AttachmentState.QUEUED_SYNC,
                  storage_type: 'permanent'
                });
                convertedToPermanent++;
              } else if (
                record.local_uri == null ||
                !(await this.storage.fileExists(
                  this.getLocalUri(record.local_uri)
                ))
              ) {
                await this.update({
                  ...record,
                  state: AttachmentState.QUEUED_DOWNLOAD
                });
                updatedToDownload++;
              } else {
                skipped++;
              }
            } catch (error) {
              // Don't log full stack traces for blob URLs (they're filtered upstream)
              if (id.includes('blob:')) {
                console.warn(
                  `[WATCH IDS] Skipped blob URL: ${id.substring(0, 30)}...`
                );
              } else {
                console.error(
                  `[WATCH IDS] Error processing attachment ${id}:`,
                  error
                );
                console.error(
                  `[WATCH IDS] Error stack:`,
                  (error as Error).stack
                );
              }
              errors++;
              // Continue processing other attachments
            }
          }

          console.log('[WATCH IDS] Processing summary:', {
            added,
            updatedToDownload,
            convertedToPermanent,
            skipped,
            errors,
            totalProcessed: ids.length
          });
        } catch (error) {
          console.error(
            '[WATCH IDS] Fatal error in watchAttachmentIds:',
            error
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
    record: Omit<AttachmentRecord, 'timestamp'>,
    tx?: Parameters<Parameters<typeof this.db.transaction>[0]>[0]
  ): Promise<AttachmentRecord> {
    const updatedRecord: AttachmentRecord = {
      ...record,
      timestamp: new Date().getTime()
    };

    // Add storage_type to the record
    const storageType = this.getStorageType();

    // Ensure all values are SQLite-compatible
    const values = [
      updatedRecord.id || null,
      updatedRecord.timestamp || new Date().getTime(),
      updatedRecord.filename || null,
      updatedRecord.local_uri ?? null,
      updatedRecord.media_type ?? null,
      updatedRecord.size ?? null,
      updatedRecord.state || AttachmentState.QUEUED_SYNC,
      storageType
    ];

    // Validate critical fields
    if (!updatedRecord.id || !updatedRecord.filename) {
      throw new Error(
        `Invalid attachment record: missing id or filename. Record: ${JSON.stringify(updatedRecord)}`
      );
    }
    try {
      await (tx ?? this.db).run(
        `INSERT OR REPLACE INTO ${this.table} 
         (id, timestamp, filename, local_uri, media_type, size, state, storage_type) 
         VALUES (${toColumns(values as string[])})`
      );
    } catch (error) {
      console.error('[saveToQueue] SQL Error:', error);
      console.error('[saveToQueue] Values:', values);
      console.error('[saveToQueue] Record:', updatedRecord);
      throw error;
    }

    // Trigger upload process for QUEUED_UPLOAD records
    if (updatedRecord.state === AttachmentState.QUEUED_UPLOAD) {
      // Trigger upload asynchronously
      void this.uploadRecordsWithProgress();
    }

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

    // Speed tracking variables
    const startTime = Date.now();
    let lastUpdateTime = startTime;
    let downloadedSinceLastSpeedCalc = 0;
    let totalBytesDownloaded = 0;

    // Update store with download starting
    useLocalStore.getState().setAttachmentSyncProgress({
      downloading: true,
      downloadCurrent: 0,
      downloadTotal: totalToDownload,
      downloadStartTime: startTime,
      lastDownloadUpdate: startTime,
      downloadSpeed: 0,
      downloadBytesPerSec: 0
    });

    try {
      console.log(`Downloading ${this.downloadQueue.size} attachments...`);

      // Convert downloadQueue to array for concurrent processing
      const idsArray = Array.from(this.downloadQueue);
      this.downloadQueue.clear();

      // Create a progress update function with speed calculation
      const updateProgress = (bytesDownloaded?: number) => {
        downloaded++;
        downloadedSinceLastSpeedCalc++;
        if (bytesDownloaded) {
          totalBytesDownloaded += bytesDownloaded;
        }

        const now = Date.now();
        const timeSinceLastUpdate = (now - lastUpdateTime) / 1000; // seconds
        const totalElapsed = (now - startTime) / 1000; // total time since start

        // CRITICAL: Always update count immediately on every file
        // This ensures per-file UI updates for responsive feel
        const shouldRecalcSpeed = timeSinceLastUpdate >= 0.2;

        if (shouldRecalcSpeed) {
          const filesPerSec =
            timeSinceLastUpdate > 0
              ? downloadedSinceLastSpeedCalc / timeSinceLastUpdate
              : downloadedSinceLastSpeedCalc / 0.2;
          const bytesPerSec =
            totalElapsed > 0 ? totalBytesDownloaded / totalElapsed : 0;

          // Log every 50 files or when speed changes significantly
          if (downloaded % 50 === 0 || downloadedSinceLastSpeedCalc >= 10) {
            console.log(
              `[DOWNLOAD] ${downloaded}/${totalToDownload} • ${filesPerSec.toFixed(1)} files/s • ${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`
            );
          }

          useLocalStore.getState().setAttachmentSyncProgress({
            downloadCurrent: downloaded,
            downloadSpeed: filesPerSec,
            downloadBytesPerSec: bytesPerSec,
            lastDownloadUpdate: now
          });

          lastUpdateTime = now;
          downloadedSinceLastSpeedCalc = 0;
        } else {
          // Update progress count immediately (but keep previous speed values)
          useLocalStore.getState().setAttachmentSyncProgress({
            downloadCurrent: downloaded,
            lastDownloadUpdate: now
          });
        }
      };

      // Balance concurrency for smooth UI updates vs speed
      // Lower concurrency = more frequent UI updates but slightly slower overall
      const CONCURRENCY_LIMIT = 25; // Balanced: fast enough, but updates visible

      // Create a queue-based concurrent download system
      const downloadQueue = [...idsArray];
      const downloadPromises: Promise<void>[] = [];

      const processDownload = async (id: string): Promise<void> => {
        try {
          const record = await this.record(id);
          if (!record) {
            updateProgress(); // No bytes for missing record
            return;
          }
          await this.downloadRecord(record);
          updateProgress(record.size || 0); // Pass file size
        } catch (error) {
          console.error(`Failed to download attachment ${id}: `, error);
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
      console.log('[UPLOAD TRIGGER] Upload already in progress, skipping');
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

      // Speed tracking variables
      const startTime = Date.now();
      let lastUpdateTime = startTime;
      let uploadedSinceLastSpeedCalc = 0;
      let totalBytesUploaded = 0;

      if (totalToUpload > 0) {
        // Update store with upload starting
        useLocalStore.getState().setAttachmentSyncProgress({
          uploading: true,
          uploadCurrent: 0,
          uploadTotal: totalToUpload,
          uploadStartTime: startTime,
          lastUploadUpdate: startTime,
          uploadSpeed: 0,
          uploadBytesPerSec: 0
        });
      }

      let record = await this.getNextUploadRecord();
      if (!record) {
        return;
      }

      while (record) {
        const uploadedSuccessfully = await this.uploadAttachment(record);
        if (!uploadedSuccessfully) {
          // Then attachment failed to upload. We try all uploads when the next trigger() is called
          break;
        }
        uploaded++;
        uploadedSinceLastSpeedCalc++;
        if (record.size) {
          totalBytesUploaded += record.size;
        }

        const now = Date.now();
        const timeSinceLastUpdate = (now - lastUpdateTime) / 1000; // seconds

        // Calculate speed every 500ms minimum to reduce render thrashing
        if (timeSinceLastUpdate >= 0.5) {
          const filesPerSec = uploadedSinceLastSpeedCalc / timeSinceLastUpdate;
          const bytesPerSec = totalBytesUploaded / ((now - startTime) / 1000);

          useLocalStore.getState().setAttachmentSyncProgress({
            uploadCurrent: uploaded,
            uploadTotal: totalToUpload,
            uploadSpeed: filesPerSec,
            uploadBytesPerSec: bytesPerSec,
            lastUploadUpdate: now
          });

          lastUpdateTime = now;
          uploadedSinceLastSpeedCalc = 0;
        } else {
          // Still update progress count
          useLocalStore.getState().setAttachmentSyncProgress({
            uploadCurrent: uploaded,
            uploadTotal: totalToUpload,
            lastUploadUpdate: now
          });
        }

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
  // trigger() {
  //   void this.uploadRecordsWithProgress();
  //   void this.downloadRecordsWithProgress();
  //   void this.expireCache();
  // }

  // Override watchDownloads to use our progress-tracking method with batching
  watchDownloads() {
    if (!this.options.downloadAttachments) {
      return;
    }
    this.idsToDownload((ids) => {
      ids.forEach((id) => this.downloadQueue.add(id));

      // Debounce download trigger to accumulate larger batches
      if (this.downloadAccumulationTimer) {
        clearTimeout(this.downloadAccumulationTimer);
      }

      this.downloadAccumulationTimer = setTimeout(() => {
        // Use our progress-tracking method
        void this.downloadRecordsWithProgress();
      }, this.DOWNLOAD_BATCH_DELAY_MS);
    });
  }

  // Override watchUploads to use our progress-tracking method with debouncing
  watchUploads() {
    this.idsToUpload((ids) => {
      if (ids.length === 0) return;

      // Debounce upload trigger to accumulate larger batches and reduce spam
      if (this.uploadAccumulationTimer) {
        clearTimeout(this.uploadAccumulationTimer);
      }

      this.uploadAccumulationTimer = setTimeout(() => {
        // Use our progress-tracking method
        void this.uploadRecordsWithProgress();
      }, this.UPLOAD_BATCH_DELAY_MS);
    });
  }

  static media_map = new BiMap({
    'audio/mp4': 'm4a', // Standard MIME type for M4A/AAC in MP4 container
    'audio/wav': 'wav', // Standard MIME type for WAV
    'audio/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif'
  });

  getExtensionFromMediaType(mediaType: string) {
    return AbstractSharedAttachmentQueue.media_map.has(mediaType)
      ? AbstractSharedAttachmentQueue.media_map.get(mediaType)!
      : 'audio/mp4'; // Default to standard M4A MIME type
  }

  getMediaTypeFromExtension(extension?: string) {
    return extension &&
      AbstractSharedAttachmentQueue.media_map.hasValue(extension)
      ? AbstractSharedAttachmentQueue.media_map.getKey(extension)!
      : 'audio/mp4'; // Default to standard M4A MIME type
  }

  async getAllAssetAttachments(assetId: string) {
    const data = await this.db
      .select({
        images: asset_synced.images,
        audio: asset_content_link_synced.audio
      })
      .from(asset_synced)
      .leftJoin(
        asset_content_link_synced,
        eq(asset_synced.id, asset_content_link_synced.asset_id)
      )
      .where(
        and(
          eq(asset_synced.id, assetId),
          or(
            isNotNull(asset_content_link_synced.audio),
            isNotNull(asset_synced.images)
          )
        )
      );

    const assetImages = data
      .flatMap((asset_synced) => asset_synced.images)
      .filter(Boolean);
    const contentLinkAudioIds = data
      .flatMap((link) => link.audio)
      .filter(Boolean);
    const allAttachments = [...assetImages, ...contentLinkAudioIds];
    const uniqueAttachments = [...new Set(allAttachments)];

    return uniqueAttachments;
  }
}
