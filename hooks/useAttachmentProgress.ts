import { useAuth } from '@/contexts/AuthContext';
import { useAudioSyncStatus } from '@/hooks/useAudioSyncStatus';
import type { LocalState } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface AttachmentProgress {
  total: number;
  synced: number;
  downloading: number;
  uploading: number;
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
 * Attachment progress for the drawer/status UI, derived from the
 * domain-driven audio sync workers (no attachments table):
 *
 * - total: audio files that should be on this device (present + confirmed
 *   remote files still to download)
 * - synced: files present locally AND not awaiting upload confirmation
 * - downloading/uploading: current work-list sizes
 *
 * `syncProgress` (current batch counters) still comes from the local store,
 * which the workers update while a batch runs.
 */
export function useAttachmentProgress(enabled = true): {
  progress: AttachmentProgress;
  syncProgress: ReturnType<typeof attachmentProgressSelector> & {
    downloadSpeed: number;
    uploadSpeed: number;
    downloadBytesPerSec: number;
    uploadBytesPerSec: number;
  };
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuth();

  const audioStatus = useAudioSyncStatus();

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

  // Use a stable selector that excludes frequently-changing values
  // Use shallow comparison to prevent re-renders when values haven't changed
  const rawSyncProgress = useLocalStore(useShallow(attachmentProgressSelector));

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
      downloadSpeed: 0,
      uploadSpeed: 0,
      downloadBytesPerSec: 0,
      uploadBytesPerSec: 0
    };
  }, [
    isAuthenticated,
    emptySyncProgress,
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
      uploading: 0,
      queued: 0,
      unsynced: 0,
      hasActivity: false
    }),
    []
  );

  const attachmentProgress = useMemo(() => {
    if (!enabled || !isAuthenticated) {
      return emptyProgress;
    }

    const {
      pendingUploads,
      pendingDownloads,
      localFileCount,
      hasActivity
    } = audioStatus;

    // Files that belong on this device: everything already here plus
    // confirmed remote files still to download.
    const total = localFileCount + pendingDownloads;
    const unsynced = pendingUploads + pendingDownloads;
    const synced = Math.max(0, total - unsynced);

    return {
      total,
      synced,
      downloading: pendingDownloads,
      uploading: pendingUploads,
      queued: 0,
      unsynced,
      hasActivity
    };
  }, [enabled, isAuthenticated, audioStatus, emptyProgress]);

  return {
    progress: attachmentProgress,
    syncProgress,
    isLoading: false
  };
}
