/**
 * In-memory inventory of the audio files on this device.
 *
 * Holds the bare filename ('{uuid}.{ext}') of every file directly under
 * shared_attachments/ — the same string as the Supabase Storage object name,
 * modulo the legacy `local/` object-name prefix (see attachmentPaths). Built
 * from one directory listing at startup and kept current by everything that
 * writes a file (storeRecordedAudio, the downloader). Exists so the
 * upload/download work lists can be derived without stat-ing tens of
 * thousands of files per scan.
 *
 * Startup first folds any pre-2.7 `shared_attachments/local/` staging files
 * into the root (migrateLegacyLocalAudioDirectory), so the scan is flat.
 *
 * Nothing ever removes entries: no code path in the app deletes local audio
 * files (there is no release mechanism yet — see the never-delete rule in
 * the attachment plan).
 */

import {
  SHARED_ATTACHMENTS_DIRECTORY,
  getLocalUri,
  listDirectoryFilenames
} from '@/utils/fileUtils';
import { migrateLegacyLocalAudioDirectory } from './migrateLegacyLocalAudio';

type Listener = () => void;

export class LocalFileIndex {
  private files = new Set<string>();
  private listeners = new Set<Listener>();
  private initPromise: Promise<void> | null = null;

  /** Idempotent; safe to call from multiple entry points. */
  init(): Promise<void> {
    this.initPromise ??= this.scan();
    return this.initPromise;
  }

  private async scan(): Promise<void> {
    try {
      await migrateLegacyLocalAudioDirectory();
    } catch (error) {
      console.warn(
        '[LocalFileIndex] Legacy local/ migration failed; continuing',
        error
      );
    }

    const rootDir = getLocalUri(SHARED_ATTACHMENTS_DIRECTORY);
    const rootFiles = await listDirectoryFilenames(rootDir);

    let changed = false;
    for (const name of rootFiles) {
      if (!this.files.has(name)) {
        this.files.add(name);
        changed = true;
      }
    }

    console.log(`[LocalFileIndex] ${this.files.size} audio files on device`);
    if (changed) this.emit();
  }

  /** @param name bare filename: '{uuid}.{ext}' */
  has(name: string): boolean {
    return this.files.has(name);
  }

  add(name: string): void {
    if (this.files.has(name)) return;
    this.files.add(name);
    this.emit();
  }

  get size(): number {
    return this.files.size;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('[LocalFileIndex] listener error:', error);
      }
    }
  }
}

export const localFileIndex = new LocalFileIndex();
