/**
 * React subscription to the domain-driven audio sync workers.
 *
 * Counts come straight from the workers' derived work lists
 * (asset_content_link rows + on-device files) — there is no queue table.
 */

import { system } from '@/db/powersync/system';
import { localFileIndex } from '@/services/attachments/LocalFileIndex';
import { useEffect, useState } from 'react';

export interface AudioSyncStatus {
  /** Files on device awaiting server-confirmed upload (audio_uploaded_at). */
  pendingUploads: number;
  activeUploads: number;
  failingUploads: number;
  /** Server-confirmed files not yet on this device. */
  pendingDownloads: number;
  activeDownloads: number;
  failingDownloads: number;
  /** Audio files currently on this device. */
  localFileCount: number;
  hasActivity: boolean;
}

function snapshot(): AudioSyncStatus {
  const upload = system.audioUploader?.getStatus() ?? {
    pending: 0,
    active: 0,
    failing: 0
  };
  const download = system.audioDownloader?.getStatus() ?? {
    pending: 0,
    active: 0,
    failing: 0
  };
  return {
    pendingUploads: upload.pending,
    activeUploads: upload.active,
    failingUploads: upload.failing,
    pendingDownloads: download.pending,
    activeDownloads: download.active,
    failingDownloads: download.failing,
    localFileCount: localFileIndex.size,
    hasActivity:
      upload.pending > 0 ||
      upload.active > 0 ||
      download.pending > 0 ||
      download.active > 0
  };
}

export function useAudioSyncStatus(): AudioSyncStatus {
  const [status, setStatus] = useState<AudioSyncStatus>(snapshot);

  useEffect(() => {
    const update = () => setStatus(snapshot());
    const unsubscribers = [
      system.audioUploader?.subscribe(update),
      system.audioDownloader?.subscribe(update),
      localFileIndex.subscribe(update)
    ];
    update();
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe?.();
    };
  }, []);

  return status;
}
