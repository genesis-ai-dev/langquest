/**
 * Downloads server-confirmed audio files that are missing from this device.
 *
 * Work list, derived on every pass:
 *
 *   asset_content_link rows where
 *     audio IS NOT NULL AND audio_uploaded_at IS NOT NULL
 *   → flattened to filenames
 *   → minus files already on this device (LocalFileIndex)
 *
 * Scope needs no code here: download_profiles already gates which rows
 * PowerSync syncs to the device. The audio_uploaded_at filter means we only
 * fetch files the server has confirmed exist — including older rows whose
 * object name still starts with `local/`. Historically-lost files stop
 * being retried and simply stay absent.
 *
 * Files always land at shared_attachments/{uuid}.{ext} (the value minus any
 * legacy `local/` prefix); the LocalFileIndex is keyed the same way.
 *
 * Nothing here marks anything "synced": a file is downloaded when it's on
 * disk, which the LocalFileIndex reflects immediately.
 */

import type * as drizzleSchema from '@/db/drizzleSchema';
import { asset_content_link } from '@/db/drizzleSchema';
import type { SupabaseStorageAdapter } from '@/db/supabase/SupabaseStorageAdapter';
import {
  isRemoteAudioObject,
  localAudioFileName,
  storageAudioObjectName
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
/** Cap on listener notifications (UI re-renders) during a busy batch. */
const NOTIFY_THROTTLE_MS = 100;

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
  /** Files in the current transfer batch (0 when idle). */
  batchTotal: number;
  /** Files completed in the current transfer batch. */
  batchDone: number;
}

export interface AudioDownloaderOptions {
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  storage: SupabaseStorageAdapter;
  fileIndex: LocalFileIndex;
  /** No transfer attempts while offline (work list is still derived). */
  isOnline: () => boolean;
}

interface DownloadItem {
  /** Bare on-disk filename (LocalFileIndex key). */
  filename: string;
  /** Storage object names to try, in order (raw audio[] values first). */
  storageNames: string[];
}

export class AudioDownloader {
  /** Keyed by on-disk filename. */
  private attempts = new Map<string, FileAttemptState>();
  private draining = false;
  private dirty = false;
  private started = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNotifyAt = 0;
  private status: AudioDownloaderStatus = {
    pending: 0,
    active: 0,
    failing: 0,
    batchTotal: 0,
    batchDone: 0
  };
  private listeners = new Set<(status: AudioDownloaderStatus) => void>();

  constructor(private options: AudioDownloaderOptions) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    this.options.db.watch(this.confirmedAudioQuery(), {
      onResult: () => this.schedule()
    });
    // The work list is "confirmed rows minus files on device", so index
    // changes (including our own downloads landing) must re-derive it —
    // otherwise the final published `pending` count goes stale until the
    // periodic tick.
    this.options.fileIndex.subscribe(() => this.schedule());

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
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.tickTimer = null;
    this.debounceTimer = null;
    this.notifyTimer = null;
    this.started = false;
  }

  private confirmedAudioQuery() {
    return this.options.db
      .select({ audio: asset_content_link.audio })
      .from(asset_content_link)
      .where(
        and(
          isNotNull(asset_content_link.audio),
          isNotNull(asset_content_link.audio_uploaded_at)
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

  private async getWorkList(): Promise<DownloadItem[]> {
    const rows = await this.confirmedAudioQuery();
    // A legacy `local/x` value and a modern `x` value share one on-disk file;
    // group by filename and remember every object name that might hold it.
    const byFilename = new Map<string, Set<string>>();
    for (const row of rows) {
      for (const value of row.audio ?? []) {
        if (!value || !isRemoteAudioObject(value)) {
          continue;
        }
        const filename = localAudioFileName(value);
        if (this.options.fileIndex.has(filename)) continue;
        let names = byFilename.get(filename);
        if (!names) {
          names = new Set();
          byFilename.set(filename, names);
        }
        names.add(value);
      }
    }
    return [...byFilename.entries()].map(([filename, names]) => {
      const storageNames = [...names];
      for (const raw of names) {
        const stripped = storageAudioObjectName(raw);
        if (!names.has(stripped)) storageNames.push(stripped);
      }
      return { filename, storageNames };
    });
  }

  private async drainOnce(): Promise<void> {
    await this.options.fileIndex.init();

    const workList = await this.getWorkList();

    const workSet = new Set(workList.map((item) => item.filename));
    for (const name of this.attempts.keys()) {
      if (!workSet.has(name)) this.attempts.delete(name);
    }

    if (workList.length === 0) {
      this.publishWorkStatus(workList, 0);
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
      (item) => (this.attempts.get(item.filename)?.nextAttemptAt ?? 0) <= now
    );
    if (ready.length === 0) {
      this.publishWorkStatus(workList, 0);
      return;
    }

    console.log(
      `[AudioDownloader] Downloading ${ready.length} of ${workList.length} missing file(s)`
    );

    let completed = 0;
    let succeeded = 0;
    const queue = [...ready];
    let active = 0;
    let pausedMidBatch = false;

    const runNext = async (): Promise<void> => {
      // The pass-start offline guard can't protect a batch already in
      // flight. Re-check before pulling each file so going offline mid-batch
      // stops the pass instead of burning through thousands of failing
      // attempts; reconnect trigger()s a fresh pass.
      if (!this.options.isOnline()) {
        if (!pausedMidBatch && queue.length > 0) {
          pausedMidBatch = true;
          console.log(
            `[AudioDownloader] Pausing batch with ${queue.length} file(s) unstarted (offline)`
          );
        }
        queue.length = 0;
        return;
      }
      const item = queue.shift();
      if (item === undefined) return;
      active++;
      this.publishWorkStatus(
        workList,
        active,
        ready.length,
        completed,
        succeeded
      );
      try {
        if (await this.downloadOne(item)) succeeded++;
      } finally {
        active--;
        completed++;
        this.publishWorkStatus(
          workList,
          active,
          ready.length,
          completed,
          succeeded
        );
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
      this.publishWorkStatus(workList, 0, 0, 0, succeeded);
    }
  }

  /** @returns true if the file is now on disk. */
  private async downloadOne({
    filename,
    storageNames
  }: DownloadItem): Promise<boolean> {
    let lastError: unknown;
    for (const storageName of storageNames) {
      try {
        const blob = await this.options.storage.downloadFile(storageName);
        const base64Data = await blobToBase64(blob);
        // eslint-disable-next-line @typescript-eslint/await-thenable -- writeFile is platform-split: sync on native (typed here), async on web
        await writeFile(getLocalAttachmentUri(filename), base64Data, {
          encoding: 'base64'
        });
        this.attempts.delete(filename);
        this.options.fileIndex.add(filename);
        return true;
      } catch (error) {
        lastError = error;
      }
    }

    const previous = this.attempts.get(filename);
    const failures = (previous?.failures ?? 0) + 1;
    const backoff =
      BACKOFF_STEPS_MS[Math.min(failures, BACKOFF_STEPS_MS.length) - 1] ??
      BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1]!;
    this.attempts.set(filename, {
      failures,
      nextAttemptAt: Date.now() + backoff,
      lastError:
        lastError instanceof Error ? lastError.message : String(lastError)
    });
    console.warn(
      `[AudioDownloader] Download failed for ${filename} (attempt ${failures}, retry in ${Math.round(backoff / 1000)}s):`,
      lastError
    );
    return false;
  }

  private publishWorkStatus(
    workList: DownloadItem[],
    active: number,
    batchTotal = 0,
    batchDone = 0,
    batchSucceeded = 0
  ): void {
    const failing = workList.filter(
      (item) => (this.attempts.get(item.filename)?.failures ?? 0) > 0
    ).length;
    this.updateStatus({
      // The work list is derived once per pass, so subtract this pass's
      // successes to keep the count moving during a long batch instead of
      // freezing at the pass-start value. Failures stay pending.
      pending: Math.max(0, workList.length - batchSucceeded),
      active,
      failing,
      batchTotal,
      batchDone
    });
  }

  private updateStatus(status: AudioDownloaderStatus): void {
    const current = this.status;
    const changed =
      status.pending !== current.pending ||
      status.active !== current.active ||
      status.failing !== current.failing ||
      status.batchTotal !== current.batchTotal ||
      status.batchDone !== current.batchDone;
    if (!changed) return;
    this.status = status;
    this.notifyThrottled();
  }

  /**
   * Batch completions can arrive many times per second; throttle listener
   * notifications while guaranteeing a trailing notify with the final state.
   */
  private notifyThrottled(): void {
    if (this.notifyTimer) return;
    const wait = NOTIFY_THROTTLE_MS - (Date.now() - this.lastNotifyAt);
    if (wait <= 0) {
      this.notifyListeners();
      return;
    }
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.notifyListeners();
    }, wait);
  }

  private notifyListeners(): void {
    this.lastNotifyAt = Date.now();
    for (const listener of this.listeners) {
      try {
        listener(this.status);
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
