import { system } from '@/db/powersync/system';
import { useEffect, useState } from 'react';

interface SyncState {
  isDownloadOperationInProgress: boolean;
  isUpdateInProgress: boolean;
  isConnected: boolean;
  isConnecting: boolean;
}

// Type guard and interface for attachment state manager
interface AttachmentStateManager {
  isDownloadOperationInProgress(): boolean;
  isUpdateInProgress(): boolean;
}

interface AttachmentQueueWithStateManager {
  attachmentStateManager?: AttachmentStateManager;
}

function getAttachmentStateManager(): AttachmentStateManager | null {
  const permQueue = system.permAttachmentQueue as
    | AttachmentQueueWithStateManager
    | undefined;
  if (!permQueue) return null;

  // Try to get state manager directly
  if (permQueue.attachmentStateManager) {
    return permQueue.attachmentStateManager;
  }

  return null;
}

export function useSyncState(): SyncState {
  const [syncState, setSyncState] = useState<SyncState>({
    isDownloadOperationInProgress: false,
    isUpdateInProgress: false,
    isConnected: false,
    isConnecting: false
  });

  useEffect(() => {
    const checkSyncState = () => {
      try {
        // Check PowerSync connection status
        const isConnected = system.powersync.connected || false;
        const isConnecting = system.powersync.connecting || false;

        // Check AttachmentStateManager state if available
        let isDownloadOperationInProgress = false;
        let isUpdateInProgress = false;

        const stateManager = getAttachmentStateManager();
        if (stateManager) {
          try {
            isDownloadOperationInProgress =
              stateManager.isDownloadOperationInProgress();
            isUpdateInProgress = stateManager.isUpdateInProgress();
          } catch (error) {
            // Fail silently if we can't access the state manager methods
            console.warn(
              'Could not access AttachmentStateManager state:',
              error
            );
          }
        }

        setSyncState({
          isDownloadOperationInProgress,
          isUpdateInProgress,
          isConnected,
          isConnecting
        });
      } catch (error) {
        console.warn('Error checking sync state:', error);
      }
    };

    // Initial check
    checkSyncState();

    // Set up polling to check sync state periodically
    const interval = setInterval(checkSyncState, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  return syncState;
}

/**
 * Returns true if any sync operation is in progress
 */
export function useIsSyncing(): boolean {
  const { isDownloadOperationInProgress, isUpdateInProgress, isConnecting } =
    useSyncState();
  return isDownloadOperationInProgress || isUpdateInProgress || isConnecting;
}
