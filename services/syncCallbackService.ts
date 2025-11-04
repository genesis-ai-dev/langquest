import { system } from '@/db/powersync/system';

type SyncCallback = () => void | Promise<void>;

/**
 * Service to register callbacks that fire after PowerSync sync completion.
 * Used to invalidate queries and clear loading states after downloads/offloads complete.
 */
class SyncCallbackService {
  private callbacks = new Map<string, SyncCallback>();
  private statusListener: (() => void) | null = null;
  private lastSyncedAt = 0;
  private isListening = false;

  /**
   * Register a callback to fire after the next PowerSync sync completes.
   * @param questId - Unique identifier for this sync operation (e.g., quest ID)
   * @param callback - Function to call after sync completes
   */
  registerCallback(questId: string, callback: SyncCallback): void {
    console.log(
      `🔄 [SyncCallback] Registering callback for quest: ${questId.slice(0, 8)}...`
    );

    // Store the callback
    this.callbacks.set(questId, callback);

    // Start listening if not already listening
    if (!this.isListening) {
      this.startListening();
    }
  }

  /**
   * Cancel a registered callback (e.g., when user cancels download)
   * @param questId - Quest ID to cancel callback for
   */
  cancelCallback(questId: string): void {
    console.log(
      `🚫 [SyncCallback] Cancelling callback for quest: ${questId.slice(0, 8)}...`
    );
    this.callbacks.delete(questId);

    // Stop listening if no more callbacks
    if (this.callbacks.size === 0) {
      this.stopListening();
    }
  }

  /**
   * Start listening to PowerSync status changes
   */
  private startListening(): void {
    if (this.isListening) return;

    console.log('👂 [SyncCallback] Starting PowerSync status listener');
    this.isListening = true;

    // Capture initial sync timestamp
    this.lastSyncedAt =
      system.powersync.currentStatus.lastSyncedAt?.getTime() ?? 0;

    // Register listener
    this.statusListener = system.powersync.registerListener({
      statusChanged: (status) => {
        const newTimestamp = status.lastSyncedAt?.getTime() ?? 0;

        // Check if sync has completed (new timestamp is newer)
        if (newTimestamp > this.lastSyncedAt) {
          console.log(
            `✅ [SyncCallback] Sync completed at: ${new Date(newTimestamp).toISOString()}`
          );
          this.lastSyncedAt = newTimestamp;
          this.fireCallbacks();
        }
      }
    });
  }

  /**
   * Stop listening to PowerSync status changes
   */
  private stopListening(): void {
    if (!this.isListening) return;

    console.log('🔇 [SyncCallback] Stopping PowerSync status listener');
    this.isListening = false;

    if (this.statusListener) {
      this.statusListener();
      this.statusListener = null;
    }
  }

  /**
   * Fire all registered callbacks and clear them
   */
  private async fireCallbacks(): Promise<void> {
    if (this.callbacks.size === 0) return;

    console.log(`🔥 [SyncCallback] Firing ${this.callbacks.size} callback(s)`);

    // Create a copy of callbacks to iterate over (since we'll clear the map)
    const callbacksToFire = Array.from(this.callbacks.entries());

    // Clear all callbacks before firing (prevents double-firing)
    this.callbacks.clear();

    // Stop listening since all callbacks are fired
    this.stopListening();

    // Fire all callbacks in parallel
    await Promise.allSettled(
      callbacksToFire.map(async ([questId, callback]) => {
        try {
          console.log(
            `🔥 [SyncCallback] Executing callback for quest: ${questId.slice(0, 8)}...`
          );
          await callback();
          console.log(
            `✅ [SyncCallback] Callback completed for quest: ${questId.slice(0, 8)}...`
          );
        } catch (error) {
          console.error(
            `❌ [SyncCallback] Callback failed for quest: ${questId.slice(0, 8)}...`,
            error
          );
        }
      })
    );
  }

  /**
   * Get count of pending callbacks
   */
  getPendingCount(): number {
    return this.callbacks.size;
  }

  /**
   * Check if a specific quest has a pending callback
   */
  hasCallback(questId: string): boolean {
    return this.callbacks.has(questId);
  }
}

// Export singleton instance
export const syncCallbackService = new SyncCallbackService();
