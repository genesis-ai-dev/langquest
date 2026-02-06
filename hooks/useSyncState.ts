import { system } from '@/db/powersync/system';
import { AttachmentState } from '@powersync/attachments';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useAttachmentStates } from './useAttachmentStates';

interface SyncState {
  isConnected: boolean;
  isConnecting: boolean;
  isDownloadOperationInProgress: boolean;
  isUpdateInProgress: boolean;
  hasSynced: boolean | undefined;
  lastSyncedAt: Date | undefined;
  downloadError: Error | undefined;
  uploadError: Error | undefined;
  unsyncedAttachmentsCount: number;
  isLoading: boolean;
}

/**
 * Returns the number of attachments that are not yet fully synced.
 * Uses InteractionManager to prevent blocking the main thread during counting.
 * @returns { unsyncedCount: number, isLoading: boolean }
 */
function useUnsyncedAttachmentsCount(): {
  unsyncedCount: number;
  isLoading: boolean;
} {
  const { attachmentStates, isLoading } = useAttachmentStates([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Move attachment state iteration off main thread to prevent blocking
  useEffect(() => {
    if (isLoading || attachmentStates.size === 0) {
      setUnsyncedCount(0);
      return;
    }

    // Defer counting to prevent blocking UI interactions
    const handle = InteractionManager.runAfterInteractions(() => {
      let count = 0;
      for (const record of attachmentStates.values()) {
        if (record.state < AttachmentState.SYNCED) {
          count++;
        }
      }
      setUnsyncedCount(count);
    });

    return () => handle.cancel();
  }, [attachmentStates, isLoading]);

  return { unsyncedCount, isLoading };
}

/**
 * Check if an error is a transient JWT expiration error.
 * These errors auto-resolve when the token refreshes, so we don't show them to users.
 */
function isTransientAuthError(error: Error | undefined): boolean {
  if (!error) return false;
  const message = error.message || '';
  // PowerSync JWT expiration errors (PSYNC_S2103)
  // These resolve automatically when Supabase refreshes the token
  return (
    message.includes('JWT has expired') ||
    message.includes('PSYNC_S2103') ||
    message.includes('jwt expired')
  );
}

function getCurrentSyncStateWithoutAttachments() {
  try {
    // Get the current sync status from PowerSync
    const status = system.powersync.currentStatus;

    // Basic connection state
    const isConnected = status.connected || false;
    const isConnecting = status.connecting || false;

    // Data flow status for downloads and uploads
    const dataFlow = status.dataFlowStatus;

    // Error information - filter out transient auth errors
    // JWT expiration errors auto-resolve when Supabase refreshes the token
    const rawDownloadError = dataFlow.downloadError;
    const rawUploadError = dataFlow.uploadError;
    const downloadError = isTransientAuthError(rawDownloadError)
      ? undefined
      : rawDownloadError;
    const uploadError = isTransientAuthError(rawUploadError)
      ? undefined
      : rawUploadError;

    // If there's an error, don't report operations as in progress
    // This prevents eternal syncing loops when errors occur
    const hasError = !!(downloadError || uploadError);
    const isDownloadOperationInProgress = hasError
      ? false
      : dataFlow.downloading || false;
    const isUpdateInProgress = hasError ? false : dataFlow.uploading || false;

    // Sync history information
    const hasSynced = status.hasSynced;
    const lastSyncedAt = status.lastSyncedAt;

    return {
      isConnected,
      isConnecting,
      isDownloadOperationInProgress,
      isUpdateInProgress,
      hasSynced,
      lastSyncedAt,
      downloadError,
      uploadError
    };
  } catch (error) {
    console.warn('Error checking sync state:', error);
    return {
      isConnected: false,
      isConnecting: false,
      isDownloadOperationInProgress: false,
      isUpdateInProgress: false,
      hasSynced: undefined,
      lastSyncedAt: undefined,
      downloadError: undefined,
      uploadError: undefined
    };
  }
}

export function useSyncState(): SyncState {
  // Call hooks at the top level
  const {
    unsyncedCount: unsyncedAttachmentsCount,
    isLoading: attachmentDataLoading
  } = useUnsyncedAttachmentsCount();

  const [baseSyncState, setBaseSyncState] = useState(() =>
    getCurrentSyncStateWithoutAttachments()
  );

  useEffect(() => {
    // Subscribe to PowerSync status changes
    const unsubscribe = system.powersync.registerListener({
      statusChanged: () => {
        setBaseSyncState(getCurrentSyncStateWithoutAttachments());
      }
    });

    return unsubscribe;
  }, []);

  // Determine overall loading state based on:
  // 1. PowerSync sync operations (connecting, downloading, uploading)
  // 2. Unsynced attachments (< AttachmentState.SYNCED)
  // 3. Whether attachment data is still loading
  // Note: Don't include error states in loading - errors should stop the loading state
  const hasError = !!(baseSyncState.downloadError || baseSyncState.uploadError);
  const isLoading =
    !hasError &&
    (attachmentDataLoading || // Attachment state data is still loading
      baseSyncState.isConnecting || // PowerSync is connecting
      baseSyncState.isDownloadOperationInProgress || // PowerSync is downloading
      baseSyncState.isUpdateInProgress || // PowerSync is uploading
      unsyncedAttachmentsCount > 0); // We have unsynced attachments

  // Combine base sync state with attachment data
  const syncState: SyncState = {
    ...baseSyncState,
    unsyncedAttachmentsCount,
    isLoading
  };

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

/**
 * Returns true if there are any sync errors
 */
export function useHasSyncErrors(): boolean {
  const { downloadError, uploadError } = useSyncState();
  return !!(downloadError || uploadError);
}

/**
 * Returns the most recent sync error if any
 */
export function useSyncError(): Error | undefined {
  const { downloadError, uploadError } = useSyncState();
  return downloadError || uploadError;
}
