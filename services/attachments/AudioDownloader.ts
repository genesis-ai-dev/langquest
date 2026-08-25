/**
 * Downloads server-confirmed audio files that are missing from this device.
 *
 * Work list, derived on every pass:
 *
 *   asset_content_link_synced rows where
 *     audio IS NOT NULL AND audio_uploaded_at IS NOT NULL
 *   → flattened to filenames
 *   → minus files already on this device (LocalFileIndex)
 *
 * Scope needs no code here: download_profiles already gates which rows
 * PowerSync syncs to the device. The audio_uploaded_at filter means we only
 * fetch files the server has confirmed exist — historically-lost files stop
 * being retried and simply stay absent.
 *
 * Nothing here marks anything "synced": a file is downloaded when it's on
 * disk, which the LocalFileIndex reflects immediately.
 */

import type * as drizzleSchema from '@/db/drizzleSchema';
import { asset_content_link_synced } from '@/db/drizzleSchemaSynced';
import type { SupabaseStorageAdapter } from '@/db/supabase/SupabaseStorageAdapter';
import { useLocalStore } from '@/store/localStore';
import {
  isInvalidAudioValue,
  isLocalOnlyAudio
} from '@/utils/attachmentPaths';
import { getLocalAttachmentUri, writeFile } from '@/utils/fileUtils';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { and, isNotNull } from 'drizzle-orm';
import type { LocalFileIndex } from './LocalFileIndex';

const DEBOUNCE_MS = 500;
const CONCURRENCY = 25;
const PERIODIC_TICK_MS = 60_000;
/** Backoff after a failed download: 30s → 2m → 10m (cap). */
const BACKOFF_STEPS_MS = [30_000, 120_000, 600_000];

interface FileAttemptState {
  failures: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface AudioDownloaderStatus {
  /** Confirmed remote files not yet on this device. */
  pending: number;
  /** Downloads currently in flight. */
  active: number;
  /** Pending files whose last attempt failed (retrying with backoff). */
  failing: number;
}

export interface AudioDownloaderOptions {
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  storage: SupabaseStorageAdapter;
  fileIndex: LocalFileIndex;
  /** No transfer attempts while offline (work list is still derived). */
  isOnline: () => boolean;
}

export class AudioDownloader {
  private attempts = new Map<string, FileAttemptState>();
  private draining = false;
  private dirty = false;
  private started = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private status: AudioDownloaderStatus = { pending: 0, active: 0, failing: 0 };
  private listeners = new Set<(status: AudioDownloaderStatus) => void>();

  constructor(private options: AudioDownloaderOptions) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    this.options.db.watch(this.confirmedAudioQuery(), {
      onResult: () => this.schedule()
    });

    this.tickTimer = setInterval(() => this.schedule(), PERIODIC_TICK_MS);
    this.schedule();
  }

  /**
   * Request an immediate pass (connectivity regained…). Clears backoff waits
   * so everything pending is retried right away; failure counts are kept, so
   * a file that fails again resumes its backoff ladder.
   */
  trigger(): void {
    for (const state of this.attempts.values()) {
      state.nextAttemptAt = 0;
    }
    this.schedule(0);
  }

  getStatus(): AudioDownloaderStatus {
    return this.status;
  }

  subscribe(listener: (status: AudioDownloaderStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.tickTimer = null;
    this.debounceTimer = null;
    this.started = false;
  }

  private confirmedAudioQuery() {
    return this.options.db
      .select({ audio: asset_content_link_synced.audio })
      .from(asset_content_link_synced)
      .where(
        and(
          isNotNull(asset_content_link_synced.audio),
          isNotNull(asset_content_link_synced.audio_uploaded_at)
        )
      );
  }

  private schedule(delay: number = DEBOUNCE_MS): void {
    if (!this.started) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.drain();
    }, delay);
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      this.dirty = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.dirty = false;
        await this.drainOnce();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- schedule() sets dirty while drainOnce() is awaited; TS narrowing can't see the re-entrant write
      } while (this.dirty);
    } catch (error) {
      console.error('[AudioDownloader] drain error:', error);
    } finally {
      this.draining = false;
    }
  }

  private async getWorkList(): Promise<string[]> {
    const rows = await this.confirmedAudioQuery();
    const names = new Set<string>();
    for (const row of rows) {
      for (const value of row.audio ?? []) {
        if (!value || isInvalidAudioValue(value) || isLocalOnlyAudio(value)) {
          continue;
        }
        names.add(value);
      }
    }
    return [...names].filter((name) => !this.options.fileIndex.has(name));
  }

  private async drainOnce(): Promise<void> {
    await this.options.fileIndex.init();

    const workList = await this.getWorkList();

    const workSet = new Set(workList);
    for (const name of this.attempts.keys()) {
      if (!workSet.has(name)) this.attempts.delete(name);
    }

    if (workList.length === 0) {
      this.updateStatus({ pending: 0, active: 0, failing: 0 });
      return;
    }

    // Offline: report honest pending counts but attempt nothing — backoff
    // state stays untouched, and reconnect trigger()s an immediate pass.
    if (!this.options.isOnline()) {
      this.publishWorkStatus(workList, 0);
      return;
    }

    const now = Date.now();
    const ready = workList.filter(
      (name) => (this.attempts.get(name)?.nextAttemptAt ?? 0) <= now
    );
    if (ready.length === 0) {
      this.publishWorkStatus(workList, 0);
      return;
    }

    console.log(
      `[AudioDownloader] Downloading ${ready.length} of ${workList.length} missing file(s)`
    );
    useLocalStore.getState().setAttachmentSyncProgress({
      downloading: true,
      downloadCurrent: 0,
      downloadTotal: ready.length,
      downloadStartTime: now,
      lastDownloadUpdate: now
    });

    let completed = 0;
    const queue = [...ready];
    let active = 0;

    const runNext = async (): Promise<void> => {
      const filename = queue.shift();
      if (filename === undefined) return;
      active++;
      this.publishWorkStatus(workList, active);
      try {
        await this.downloadOne(filename);
      } finally {
        active--;
        completed++;
        useLocalStore.getState().setAttachmentSyncProgress({
          downloadCurrent: completed,
          lastDownloadUpdate: Date.now()
        });
        this.publishWorkStatus(workList, active);
      }
      return runNext();
    };

    try {
      await Promise.allSettled(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () =>
          runNext()
        )
      );
    } finally {
      useLocalStore.getState().setAttachmentSyncProgress({
        downloading: false
      });
      this.publishWorkStatus(workList, 0);
    }
  }

  private async downloadOne(filename: string): Promise<void> {
    try {
      const blob = await this.options.storage.downloadFile(filename);
      const base64Data = await blobToBase64(blob);
      // eslint-disable-next-line @typescript-eslint/await-thenable -- writeFile is platform-split: sync on native (typed here), async on web
      await writeFile(getLocalAttachmentUri(filename), base64Data, {
        encoding: 'base64'
      });
      this.attempts.delete(filename);
      this.options.fileIndex.add(filename);
    } catch (error) {
      const previous = this.attempts.get(filename);
      const failures = (previous?.failures ?? 0) + 1;
      const backoff =
        BACKOFF_STEPS_MS[
          Math.min(failures, BACKOFF_STEPS_MS.length) - 1
        ] ?? BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1]!;
      this.attempts.set(filename, {
        failures,
        nextAttemptAt: Date.now() + backoff,
        lastError: error instanceof Error ? error.message : String(error)
      });
      console.warn(
        `[AudioDownloader] Download failed for ${filename} (attempt ${failures}, retry in ${Math.round(backoff / 1000)}s):`,
        error
      );
    }
  }

  private publishWorkStatus(workList: string[], active: number): void {
    const failing = workList.filter(
      (name) => (this.attempts.get(name)?.failures ?? 0) > 0
    ).length;
    this.updateStatus({ pending: workList.length, active, failing });
  }

  private updateStatus(status: AudioDownloaderStatus): void {
    const changed =
      status.pending !== this.status.pending ||
      status.active !== this.status.active ||
      status.failing !== this.status.failing;
    if (!changed) return;
    this.status = status;
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[AudioDownloader] listener error:', error);
      }
    }
  }
}

/** Blob → base64 payload (same approach the old queue used; RN-safe). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // readAsDataURL always yields a string result.
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.replace(/^data:.+;base64,/, ''));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
