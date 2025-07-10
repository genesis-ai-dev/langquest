import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import type * as drizzleSchema from '../drizzleSchema';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';
import { AttachmentStateManager } from './AttachmentStateManager';

export class TempAttachmentQueue extends AbstractSharedAttachmentQueue {
  private _onUpdateCallback: ((ids: string[]) => void) | null = null;
  // Track currently viewed attachments
  private currentTempAttachments = new Set<string>();
  // Cleanup timer for temporary attachments
  private cleanupTimer: NodeJS.Timeout | null = null;
  // How long to keep temporary attachments (in milliseconds)
  private static readonly TEMP_CACHE_DURATION: number = 5 * 60 * 1000; // 5 minutes
  // Use unified attachment state manager for consistency
  private attachmentStateManager: AttachmentStateManager;

  constructor(
    options: Omit<
      AttachmentQueueOptions,
      'onDownloadError' | 'onUploadError'
    > & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
      onDownloadError: (
        attachment: AttachmentRecord,
        exception: { toString: () => string; status?: number }
      ) => void;
      onUploadError: (
        _attachment: AttachmentRecord,
        _exception: {
          error: string;
          message: string;
          statusCode: number;
        }
      ) => Promise<{
        retry: boolean;
      }>;
    }
  ) {
    super(options);
    this.db = options.db;
    console.log(
      '[TEMP QUEUE] ✅ Initialized with unified attachment state manager'
    );

    // Get the singleton AttachmentStateManager
    this.attachmentStateManager = AttachmentStateManager.getInstance();
  }

  getStorageType(): 'permanent' | 'temporary' {
    return 'temporary';
  }

  async init() {
    await super.init();

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      void this.cleanupOldTempAttachments();
    }, TempAttachmentQueue.TEMP_CACHE_DURATION);

    console.log(
      '[TEMP QUEUE] ✅ Initialized with unified attachment state manager'
    );
  }

  // Clean up temporary attachments that haven't been accessed recently
  private async cleanupOldTempAttachments() {
    try {
      const cutoffTime = Date.now() - TempAttachmentQueue.TEMP_CACHE_DURATION;

      const oldTempAttachments = await this.powersync.getAll<AttachmentRecord>(
        `SELECT * FROM ${this.table} 
         WHERE storage_type = 'temporary' 
         AND timestamp < ?`,
        [cutoffTime]
      );

      if (oldTempAttachments.length > 0) {
        console.log(
          `[TEMP QUEUE] Cleaning up ${oldTempAttachments.length} old temporary attachments`
        );

        await this.powersync.writeTransaction(async (tx) => {
          for (const record of oldTempAttachments) {
            await this.delete(record, tx);
            this.currentTempAttachments.delete(record.id);
          }
        });

        // Update the callback with current list
        if (this._onUpdateCallback) {
          this._onUpdateCallback([...this.currentTempAttachments]);
        }
      }
    } catch (error) {
      console.error('[TEMP QUEUE] Error during cleanup:', error);
    }
  }

  // Modified to store the callback and initialize empty list
  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    this._onUpdateCallback = onUpdate;

    // Initialize with current temporary attachments
    onUpdate([...this.currentTempAttachments]);
  }

  // Enhanced method to load attachments for an asset with proper tracking
  async loadAssetAttachments(assetId: string): Promise<void> {
    try {
      console.log(`[TEMP QUEUE] Loading attachments for asset: ${assetId}`);

      // Use unified AttachmentStateManager for consistency
      const attachmentIds =
        await this.attachmentStateManager.getAttachmentIdsForAssets([assetId]);

      if (attachmentIds.length === 0) {
        console.log(`[TEMP QUEUE] No attachments found for asset ${assetId}`);
        return;
      }

      console.log(
        `[TEMP QUEUE] Found ${attachmentIds.length} attachments for asset ${assetId}: ${attachmentIds.join(', ')}`
      );

      // Add new attachments to current set
      let hasChanges = false;
      for (const id of attachmentIds) {
        if (!this.currentTempAttachments.has(id)) {
          this.currentTempAttachments.add(id);
          hasChanges = true;
        }
      }

      // Update PowerSync if there are changes
      if (hasChanges && this._onUpdateCallback) {
        console.log(
          `[TEMP QUEUE] Updated temp attachments, now tracking ${this.currentTempAttachments.size} attachments`
        );
        this._onUpdateCallback([...this.currentTempAttachments]);
      }
    } catch (error) {
      console.error(
        `[TEMP QUEUE] Error loading attachments for asset ${assetId}:`,
        error
      );
    }
  }

  // Method to manually add specific attachment IDs
  addTempAttachments(attachmentIds: string[]): void {
    let hasChanges = false;

    for (const id of attachmentIds) {
      if (!this.currentTempAttachments.has(id)) {
        this.currentTempAttachments.add(id);
        hasChanges = true;
      }
    }

    if (hasChanges && this._onUpdateCallback) {
      console.log(
        `[TEMP QUEUE] Added ${attachmentIds.length} temp attachments, now tracking ${this.currentTempAttachments.size} attachments`
      );
      this._onUpdateCallback([...this.currentTempAttachments]);
    }
  }

  // Method to remove specific attachment IDs from temp tracking
  removeTempAttachments(attachmentIds: string[]): void {
    let hasChanges = false;

    for (const id of attachmentIds) {
      if (this.currentTempAttachments.has(id)) {
        this.currentTempAttachments.delete(id);
        hasChanges = true;
      }
    }

    if (hasChanges && this._onUpdateCallback) {
      console.log(
        `[TEMP QUEUE] Removed ${attachmentIds.length} temp attachments, now tracking ${this.currentTempAttachments.size} attachments`
      );
      this._onUpdateCallback([...this.currentTempAttachments]);
    }
  }

  // Clear all temporary attachments from tracking
  clearTempAttachments(): void {
    if (this.currentTempAttachments.size > 0) {
      console.log(
        `[TEMP QUEUE] Clearing all ${this.currentTempAttachments.size} temp attachments`
      );
      this.currentTempAttachments.clear();

      if (this._onUpdateCallback) {
        this._onUpdateCallback([]);
      }
    }
  }

  // Get currently tracked temporary attachment IDs
  getCurrentTempAttachments(): string[] {
    return [...this.currentTempAttachments];
  }

  async deleteFromQueue(attachmentId: string): Promise<void> {
    const record = await this.record(attachmentId);
    if (record) {
      await this.delete(record);
      this.currentTempAttachments.delete(attachmentId);

      // Update the callback
      if (this._onUpdateCallback) {
        this._onUpdateCallback([...this.currentTempAttachments]);
      }
    }
  }

  // Get debug info
  getDebugInfo() {
    return {
      currentTempAttachments: this.currentTempAttachments.size,
      tempAttachmentsList: [...this.currentTempAttachments],
      stateManager: this.attachmentStateManager.getDebugInfo()
    };
  }

  // Cleanup method
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.attachmentStateManager.destroy();
    this.currentTempAttachments.clear();
    this._onUpdateCallback = null;
  }
}
