import { useAuth } from '@/contexts/AuthContext';
import { useAudioSyncStatus } from '@/hooks/useAudioSyncStatus';
import { useMemo } from 'react';

export interface AttachmentProgress {
  total: number;
  synced: number;
  downloading: number;
  uploading: number;
  unsynced: number;
  hasActivity: boolean;
}

/** Live counters for the transfer batch currently running (zeros when idle). */
export interface AttachmentBatchProgress {
  downloading: boolean;
  uploading: boolean;
  downloadCurrent: number;
  downloadTotal: number;
  uploadCurrent: number;
  uploadTotal: number;
}

const EMPTY_BATCH: AttachmentBatchProgress = {
  downloading: false,
  uploading: false,
  downloadCurrent: 0,
  downloadTotal: 0,
  uploadCurrent: 0,
  uploadTotal: 0
};

const EMPTY_PROGRESS: AttachmentProgress = {
  total: 0,
  synced: 0,
  downloading: 0,
  uploading: 0,
  unsynced: 0,
  hasActivity: false
};

/**
 * Attachment progress for the drawer/status UI, derived entirely from the
 * domain-driven audio sync workers (no attachments table, no store):
 *
 * - progress: state of the world — files that should be on this device,
 *   how many are synced, and per-direction pending counts
 * - syncProgress: the batch currently transferring (per-direction current/total)
 *
 * Both come from the workers' status fields via useAudioSyncStatus.
 */
export function useAttachmentProgress(enabled = true): {
  progress: AttachmentProgress;
  syncProgress: AttachmentBatchProgress;
} {
  const { isAuthenticated } = useAuth();

  const audioStatus = useAudioSyncStatus();

  const syncProgress = useMemo<AttachmentBatchProgress>(() => {
    if (!enabled || !isAuthenticated) {
      return EMPTY_BATCH;
    }
    return {
      downloading: audioStatus.downloadBatchTotal > 0,
      uploading: audioStatus.uploadBatchTotal > 0,
      downloadCurrent: audioStatus.downloadBatchDone,
      downloadTotal: audioStatus.downloadBatchTotal,
      uploadCurrent: audioStatus.uploadBatchDone,
      uploadTotal: audioStatus.uploadBatchTotal
    };
  }, [
    enabled,
    isAuthenticated,
    audioStatus.downloadBatchTotal,
    audioStatus.downloadBatchDone,
    audioStatus.uploadBatchTotal,
    audioStatus.uploadBatchDone
  ]);

  const progress = useMemo<AttachmentProgress>(() => {
    if (!enabled || !isAuthenticated) {
      return EMPTY_PROGRESS;
    }

    const { pendingUploads, pendingDownloads, localFileCount, hasActivity } =
      audioStatus;

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
      unsynced,
      hasActivity
    };
  }, [enabled, isAuthenticated, audioStatus]);

  return {
    progress,
    syncProgress
  };
}
