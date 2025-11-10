import { useAuth } from '@/contexts/AuthContext';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import type { LocalState } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { AttachmentState } from '@powersync/attachments';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface AttachmentProgress {
  total: number;
  synced: number;
  downloading: number;
  queued: number;
  unsynced: number;
  hasActivity: boolean;
}

/**
 * Selective selector that excludes timestamps and frequently-changing speed values
 * This prevents re-renders when only timestamps or speeds change
 * We only care about counts and boolean states for the drawer
 *
 * Returns a stable object reference when values haven't changed
 */
const EMPTY_SELECTOR_RESULT = {
  downloading: false,
  uploading: false,
  downloadCurrent: 0,
  downloadTotal: 0,
  uploadCurrent: 0,
  uploadTotal: 0
} as const;

function attachmentProgressSelector(state: LocalState) {
  const progress = state.attachmentSyncProgress;

  // Return stable empty object if all values are zero/false
  if (
    !progress.downloading &&
    !progress.uploading &&
    progress.downloadCurrent === 0 &&
    progress.downloadTotal === 0 &&
    progress.uploadCurrent === 0 &&
    progress.uploadTotal === 0
  ) {
    return EMPTY_SELECTOR_RESULT;
  }

  return {
    downloading: progress.downloading,
    uploading: progress.uploading,
    downloadCurrent: progress.downloadCurrent,
    downloadTotal: progress.downloadTotal,
    uploadCurrent: progress.uploadCurrent,
    uploadTotal: progress.uploadTotal
    // Intentionally exclude:
    // - Timestamps (downloadStartTime, uploadStartTime, lastDownloadUpdate, lastUploadUpdate)
    // - Speeds (downloadSpeed, uploadSpeed, downloadBytesPerSec, uploadBytesPerSec) - change too frequently
  };
}

/**
 * Hook that provides attachment progress tracking with throttling and memoization
 * to prevent cascading re-renders.
 *
 * @param enabled - Only query attachment states when enabled (e.g., when drawer is open)
 */
export function useAttachmentProgress(enabled = true): {
  progress: AttachmentProgress;
  syncProgress: ReturnType<typeof attachmentProgressSelector>;
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuth();

  // Get attachment states only when enabled
  const { attachmentStates, isLoading: attachmentStatesLoading } =
    useAttachmentStates([], enabled && isAuthenticated);

  // Stable empty progress object for anonymous users (never changes)
  const emptySyncProgress = useMemo(
    () => ({
      downloading: false,
      uploading: false,
      downloadCurrent: 0,
      downloadTotal: 0,
      uploadCurrent: 0,
      uploadTotal: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      downloadBytesPerSec: 0,
      uploadBytesPerSec: 0
    }),
    []
  );

  // Always call the hook (Rules of Hooks)
  // Use a stable selector that excludes frequently-changing values
  // Use shallow comparison to prevent re-renders when values haven't changed
  const rawSyncProgress = useLocalStore(useShallow(attachmentProgressSelector));

  // Stable reference for syncProgress - only create new object when values change
  // Compare individual values to prevent unnecessary object creation
  const syncProgress = useMemo(() => {
    if (!isAuthenticated) {
      return emptySyncProgress;
    }

    // Create object with speed fields for compatibility
    return {
      downloading: rawSyncProgress.downloading,
      uploading: rawSyncProgress.uploading,
      downloadCurrent: rawSyncProgress.downloadCurrent,
      downloadTotal: rawSyncProgress.downloadTotal,
      uploadCurrent: rawSyncProgress.uploadCurrent,
      uploadTotal: rawSyncProgress.uploadTotal,
      downloadSpeed: 0, // Not used in drawer, set to 0 to avoid re-renders
      uploadSpeed: 0, // Not used in drawer, set to 0 to avoid re-renders
      downloadBytesPerSec: 0, // Not used in drawer, set to 0 to avoid re-renders
      uploadBytesPerSec: 0 // Not used in drawer, set to 0 to avoid re-renders
    };
  }, [
    isAuthenticated,
    emptySyncProgress,
    // Compare individual values instead of whole object to prevent unnecessary updates
    rawSyncProgress.downloading,
    rawSyncProgress.uploading,
    rawSyncProgress.downloadCurrent,
    rawSyncProgress.downloadTotal,
    rawSyncProgress.uploadCurrent,
    rawSyncProgress.uploadTotal
  ]);

  // Stable empty progress object
  const emptyProgress: AttachmentProgress = useMemo(
    () => ({
      total: 0,
      synced: 0,
      downloading: 0,
      queued: 0,
      unsynced: 0,
      hasActivity: false
    }),
    []
  );

  // Calculate attachment progress stats
  // useMemo will prevent recalculation when dependencies don't change
  const attachmentProgress = useMemo(() => {
    // Short-circuit when disabled or not authenticated
    if (!enabled || !isAuthenticated || attachmentStatesLoading) {
      return emptyProgress;
    }

    // Calculate counts efficiently in a single pass
    const total = attachmentStates.size;
    let synced = 0;
    let downloading = 0;
    let queued = 0;

    for (const record of attachmentStates.values()) {
      if (record.state === AttachmentState.SYNCED) {
        synced++;
      } else if (record.state === AttachmentState.QUEUED_DOWNLOAD) {
        downloading++;
      } else if (record.state === AttachmentState.QUEUED_SYNC) {
        queued++;
      }
    }

    const hasActivity = downloading > 0 || queued > 0;
    const unsynced = total - synced;

    // Create new object - useMemo ensures this only happens when dependencies change
    return {
      total,
      synced,
      downloading,
      queued,
      hasActivity,
      unsynced
    };
  }, [
    enabled,
    isAuthenticated,
    attachmentStatesLoading,
    attachmentStates,
    emptyProgress
  ]);

  // Return progress directly - useMemo already handles memoization
  // The batching in AbstractSharedAttachmentQueue reduces update frequency
  return {
    progress: attachmentProgress,
    syncProgress,
    isLoading: attachmentStatesLoading
  };
}
