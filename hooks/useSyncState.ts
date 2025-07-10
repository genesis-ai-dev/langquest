import { system } from '@/db/powersync/system';
import { AttachmentState } from '@powersync/attachments';
import { useEffect, useState } from 'react';
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
 * @param attachmentIds Array of attachment IDs to check.
 * @returns { unsyncedCount: number, isLoading: boolean }
 */
function useUnsyncedAttachmentsCount(): { unsyncedCount: number; isLoading: boolean } {
  // get all attachment ids from the attachment table

  const { attachmentStates, isLoading } = useAttachmentStates([]);

  // Count attachments with state less than SYNCED
  let unsyncedCount = 0;
  if (!isLoading && attachmentStates.size > 0) {
    for (const record of attachmentStates.values()) {
      if (record.state < AttachmentState.SYNCED) {
        unsyncedCount++;
      }
    }
  }

  return { unsyncedCount, isLoading };
}

function getCurrentSyncStateWithoutAttachments() {
  try {
    // Get the current sync status from PowerSync
    const status = system.powersync.currentStatus;

    // Debug: log the full status object to see what we're getting
    console.log('PowerSync currentStatus:', JSON.stringify(status, null, 2));

    // Basic connection state
    const isConnected = status.connected || false;
    const isConnecting = status.connecting || false;

    // Data flow status for downloads and uploads
    const dataFlow = status.dataFlowStatus;
    const isDownloadOperationInProgress = dataFlow.downloading || false;
    const isUpdateInProgress = dataFlow.uploading || false;

    // Sync history information
    const hasSynced = status.hasSynced;
    const lastSyncedAt = status.lastSyncedAt;

    // Error information
    const downloadError = dataFlow.downloadError;
    const uploadError = dataFlow.uploadError;

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
  const { unsyncedCount: unsyncedAttachmentsCount, isLoading: attachmentDataLoading } = useUnsyncedAttachmentsCount();

  const [baseSyncState, setBaseSyncState] = useState(() => getCurrentSyncStateWithoutAttachments());

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
  const isLoading =
    attachmentDataLoading || // Attachment state data is still loading
    baseSyncState.isConnecting || // PowerSync is connecting
    baseSyncState.isDownloadOperationInProgress || // PowerSync is downloading
    baseSyncState.isUpdateInProgress || // PowerSync is uploading
    unsyncedAttachmentsCount > 0; // We have unsynced attachments

  // Combine base sync state with attachment data
  const syncState: SyncState = {
    ...baseSyncState,
    unsyncedAttachmentsCount,
    isLoading
  };

  console.log('Derived sync state:', syncState);

  return syncState;
}

/**
 * Returns true if any sync operation is in progress
 */
export function useIsSyncing(): boolean {
  const { isDownloadOperationInProgress, isUpdateInProgress, isConnecting } = useSyncState();
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
