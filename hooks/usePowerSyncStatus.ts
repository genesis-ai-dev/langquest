import { system } from '@/db/powersync/system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PowerSyncStatus {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  uploading: boolean;
  hasSynced: boolean | undefined;
  lastSyncedAt: Date | undefined; // For display only, not in dependency comparisons
  downloadError: Error | undefined;
  uploadError: Error | undefined;
}

/**
 * Gets current PowerSync status without subscribing
 */
function getCurrentPowerSyncStatus(): PowerSyncStatus {
  try {
    const status = system.powersync.currentStatus;
    const dataFlow = status.dataFlowStatus;

    return {
      connected: status.connected || false,
      connecting: status.connecting || false,
      downloading: dataFlow.downloading || false,
      uploading: dataFlow.uploading || false,
      hasSynced: status.hasSynced,
      lastSyncedAt: status.lastSyncedAt,
      downloadError: dataFlow.downloadError,
      uploadError: dataFlow.uploadError
    };
  } catch (error) {
    console.warn('Error getting PowerSync status:', error);
    return {
      connected: false,
      connecting: false,
      downloading: false,
      uploading: false,
      hasSynced: undefined,
      lastSyncedAt: undefined,
      downloadError: undefined,
      uploadError: undefined
    };
  }
}

/**
 * Memoized hook for PowerSync status that prevents unnecessary re-renders.
 * Excludes timestamps from dependency comparisons to avoid cascading updates.
 */
export function usePowerSyncStatus(): PowerSyncStatus {
  const [status, setStatus] = useState(() => getCurrentPowerSyncStatus());

  // Track previous meaningful values (excluding timestamps) to prevent unnecessary updates
  const prevStatusRef = useRef<Omit<PowerSyncStatus, 'lastSyncedAt'>>({
    connected: status.connected,
    connecting: status.connecting,
    downloading: status.downloading,
    uploading: status.uploading,
    hasSynced: status.hasSynced,
    downloadError: status.downloadError,
    uploadError: status.uploadError
  });

  // Update function that only sets state when meaningful values change
  const updateStatus = useCallback(() => {
    const newStatus = getCurrentPowerSyncStatus();
    const prev = prevStatusRef.current;

    // Check if meaningful values changed (excluding lastSyncedAt)
    const hasChanged =
      prev.connected !== newStatus.connected ||
      prev.connecting !== newStatus.connecting ||
      prev.downloading !== newStatus.downloading ||
      prev.uploading !== newStatus.uploading ||
      prev.hasSynced !== newStatus.hasSynced ||
      prev.downloadError !== newStatus.downloadError ||
      prev.uploadError !== newStatus.uploadError;

    if (hasChanged) {
      prevStatusRef.current = {
        connected: newStatus.connected,
        connecting: newStatus.connecting,
        downloading: newStatus.downloading,
        uploading: newStatus.uploading,
        hasSynced: newStatus.hasSynced,
        downloadError: newStatus.downloadError,
        uploadError: newStatus.uploadError
      };
      setStatus(newStatus);
    } else {
      // Even if meaningful values didn't change, update lastSyncedAt if it changed
      // This allows the display value to update without causing re-renders
      setStatus((prev) => ({
        ...prev,
        lastSyncedAt: newStatus.lastSyncedAt
      }));
    }
  }, []);

  useEffect(() => {
    // Subscribe to PowerSync status changes
    const unsubscribe = system.powersync.registerListener({
      statusChanged: updateStatus
    });

    return unsubscribe;
  }, [updateStatus]);

  // Memoize the returned status to ensure stable reference when values don't change
  return useMemo(() => status, [
    status.connected,
    status.connecting,
    status.downloading,
    status.uploading,
    status.hasSynced,
    status.downloadError,
    status.uploadError
    // Intentionally exclude lastSyncedAt from deps to prevent re-renders
  ]);
}

