/**
 * Uploads recorded audio files to Supabase Storage, driven entirely by domain
 * data — there is no persisted queue.
 *
 * The work list is derived on every pass:
 *
 *   asset_content_link_synced rows where
 *     audio IS NOT NULL AND audio_uploaded_at IS NULL
 *   → flattened to filenames
 *   → minus 'local/…' values (pre-publish recordings never upload)
 *   → intersected with the files actually on this device (LocalFileIndex)
 *
 * Only the synced view is consulted: local (pre-publish) rows always carry
 * 'local/…' audio values, and nothing uploads until the user publishes.
 *
 * Completion is never declared here: the server's storage trigger stamps
 * asset_content_link.audio_uploaded_at, PowerSync syncs it down, and the row
 * falls out of the work-list query. Until that happens a successful upload
 * only earns a grace period before it becomes eligible again — re-uploading
 * is harmless (storage upsert), so a lost confirmation self-heals.
 *
 * Failures are never terminal. Each file gets an in-memory exponential
 * backoff; nothing here ever touches a local file.
 */

import type * as drizzleSchema from '@/db/drizzleSchema';
import { asset_content_link_synced } from '@/db/drizzleSchemaSynced';
import type { SupabaseStorageAdapter } from '@/db/supabase/SupabaseStorageAdapter';
import { isInvalidAudioValue, isLocalOnlyAudio } from '@/utils/attachmentPaths';
import { getLocalAttachmentUri } from '@/utils/fileUtils';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { and, isNotNull, isNull } from 'drizzle-orm';
import type { LocalFileIndex } from './LocalFileIndex';

const DEBOUNCE_MS = 2000;
const CONCURRENCY = 4;
const PERIODIC_TICK_MS = 60_000;
/** Backoff after a failed upload: 30s → 1m → 5m → 30m (cap). */
const BACKOFF_STEPS_MS = [30_000, 60_000, 300_000, 1_800_000];
/**
 * After a successful upload, how long to wait for the server-stamped
 * audio_uploaded_at to sync down before re-uploading (idempotent) in case
 * the confirmation was lost.
 */
const CONFIRMATION_GRACE_MS = 10 * 60_000;
/** Cap on listener notifications (UI re-renders) during a busy batch. */
const NOTIFY_THROTTLE_MS = 100;

const MEDIA_TYPES: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  aac: 'audio/aac'
};

export function mediaTypeForFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return MEDIA_TYPES[extension] ?? 'application/octet-stream';
}

interface FileAttemptState {
  failures: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface AudioUploaderStatus {
  /** Files referenced by rows without server confirmation, present on disk. */
  pending: number;
  /** Uploads currently in flight. */
  active: number;
  /** Pending files whose last attempt failed (retrying with backoff). */
  failing: number;
  /** Files in the current transfer batch (0 when idle). */
  batchTotal: number;
  /** Files completed in the current transfer batch. */
  batchDone: number;
}

export interface AudioUploaderOptions {
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  storage: SupabaseStorageAdapter;
  fileIndex: LocalFileIndex;
  /** Uploads need an authenticated session (storage RLS). */
  hasSession: () => Promise<boolean>;
  /** No transfer attempts while offline (work list is still derived). */
  isOnline: () => boolean;
}

export class AudioUploader {
  private attempts = new Map<string, FileAttemptState>();
  private draining = false;
  private dirty = false;
  private started = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNotifyAt = 0;
  private status: AudioUploaderStatus = {
    pending: 0,
    active: 0,
    failing: 0,
    batchTotal: 0,
    batchDone: 0
  };
  private listeners = new Set<(status: AudioUploaderStatus) => void>();

  constructor(private options: AudioUploaderOptions) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    // The watch is a signal only; every drain re-derives the work list.
    this.options.db.watch(this.pendingSyncedQuery(), {
      onResult: () => this.schedule()
    });
    this.options.fileIndex.subscribe(() => this.schedule());

    this.tickTimer = setInterval(() => this.schedule(), PERIODIC_TICK_MS);
    this.schedule();
  }

  /**
   * Request an immediate pass (connectivity regained, publish finished…).
   * Clears backoff waits so everything pending is retried right away; failure
   * counts are kept, so a file that fails again resumes its backoff ladder.
   */
  trigger(): void {
    for (const state of this.attempts.values()) {
      state.nextAttemptAt = 0;
    }
    this.schedule(0);
  }

  getStatus(): AudioUploaderStatus {
    return this.status;
  }

  subscribe(listener: (status: AudioUploaderStatus) => void): () => void {
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

  private pendingSyncedQuery() {
    return this.options.db
      .select({ audio: asset_content_link_synced.audio })
      .from(asset_content_link_synced)
      .where(
        and(
          isNotNull(asset_content_link_synced.audio),
          isNull(asset_content_link_synced.audio_uploaded_at)
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
      console.error('[AudioUploader] drain error:', error);
    } finally {
      this.draining = false;
    }
  }

  /**
   * All unconfirmed, uploadable filenames present on this device —
   * including ones currently backing off.
   */
  private async getWorkList(): Promise<string[]> {
    const syncedRows = await this.pendingSyncedQuery();

    const names = new Set<string>();
    for (const row of syncedRows) {
      for (const value of row.audio ?? []) {
        if (!value || isInvalidAudioValue(value) || isLocalOnlyAudio(value)) {
          continue;
        }
        names.add(value);
      }
    }
    return [...names].filter((name) => this.options.fileIndex.has(name));
  }

  private async drainOnce(): Promise<void> {
    await this.options.fileIndex.init();

    const workList = await this.getWorkList();

    // Drop attempt records for files that got confirmed or disappeared.
    const workSet = new Set(workList);
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

    if (!(await this.options.hasSession())) {
      console.log(
        `[AudioUploader] ${workList.length} file(s) pending but no auth session; will retry`
      );
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
      `[AudioUploader] Uploading ${ready.length} of ${workList.length} pending file(s)`
    );

    let completed = 0;
    let succeeded = 0;
    const queue = [...ready];
    let active = 0;

    const runNext = async (): Promise<void> => {
      const filename = queue.shift();
      if (filename === undefined) return;
      active++;
      this.publishWorkStatus(
        workList,
        active,
        ready.length,
        completed,
        succeeded
      );
      try {
        if (await this.uploadOne(filename)) succeeded++;
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

  /** @returns true if the file was accepted by storage. */
  private async uploadOne(filename: string): Promise<boolean> {
    try {
      const localUri = getLocalAttachmentUri(filename);
      const buffer = await this.options.storage.readFile(localUri);
      await this.options.storage.uploadFile(filename, buffer, {
        mediaType: mediaTypeForFilename(filename)
      });
      // Uploaded, but only the synced-down audio_uploaded_at confirms it.
      // Grace period prevents hammering while the confirmation round-trips.
      this.attempts.set(filename, {
        failures: 0,
        nextAttemptAt: Date.now() + CONFIRMATION_GRACE_MS
      });
      console.log(`[AudioUploader] Uploaded ${filename}`);
      return true;
    } catch (error) {
      const previous = this.attempts.get(filename);
      const failures = (previous?.failures ?? 0) + 1;
      const backoff =
        BACKOFF_STEPS_MS[Math.min(failures, BACKOFF_STEPS_MS.length) - 1] ??
        BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1]!;
      this.attempts.set(filename, {
        failures,
        nextAttemptAt: Date.now() + backoff,
        lastError: error instanceof Error ? error.message : String(error)
      });
      console.warn(
        `[AudioUploader] Upload failed for ${filename} (attempt ${failures}, retry in ${Math.round(backoff / 1000)}s):`,
        error
      );
      return false;
    }
  }

  private publishWorkStatus(
    workList: string[],
    active: number,
    batchTotal = 0,
    batchDone = 0,
    batchSucceeded = 0
  ): void {
    const failing = workList.filter(
      (name) => (this.attempts.get(name)?.failures ?? 0) > 0
    ).length;
    this.updateStatus({
      // The work list is derived once per pass, so subtract this pass's
      // successes to keep the count moving during a long batch instead of
      // freezing at the pass-start value. Re-derivation at pass end corrects
      // any drift (failures stay pending; confirmations may still be in
      // flight).
      pending: Math.max(0, workList.length - batchSucceeded),
      active,
      failing,
      batchTotal,
      batchDone
    });
  }

  private updateStatus(status: AudioUploaderStatus): void {
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
        console.error('[AudioUploader] listener error:', error);
      }
    }
  }
}
