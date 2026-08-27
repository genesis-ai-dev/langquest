/**
 * In-memory inventory of the audio files on this device.
 *
 * Holds the relative names of every file under shared_attachments/
 * ('{uuid}.{ext}' for published audio, 'local/{uuid}.{ext}' for pre-publish
 * recordings). Built from one directory listing at startup and kept current
 * by everything that writes a file (saveAudioLocally, promoteLocalAudio, the
 * downloader). Exists so the upload/download work lists can be derived
 * without stat-ing tens of thousands of files per scan.
 *
 * Nothing ever removes entries: no code path in the app deletes local audio
 * files (there is no release mechanism yet — see the never-delete rule in
 * the attachment plan).
 */

import { LOCAL_AUDIO_PREFIX } from '@/utils/attachmentPaths';
import {
  SHARED_ATTACHMENTS_DIRECTORY,
  getLocalUri,
  listDirectoryFilenames
} from '@/utils/fileUtils';

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

  /** Re-list the directories (e.g. after a restore). Additive only. */
  async refresh(): Promise<void> {
    await this.init();
    await this.scan();
  }

  private async scan(): Promise<void> {
    const rootDir = getLocalUri(SHARED_ATTACHMENTS_DIRECTORY);
    const localDir = getLocalUri(
      `${SHARED_ATTACHMENTS_DIRECTORY}/${LOCAL_AUDIO_PREFIX}`
    );
    const [rootFiles, localFiles] = await Promise.all([
      listDirectoryFilenames(rootDir),
      listDirectoryFilenames(localDir)
    ]);

    let changed = false;
    for (const name of rootFiles) {
      if (!this.files.has(name)) {
        this.files.add(name);
        changed = true;
      }
    }
    for (const name of localFiles) {
      const key = `${LOCAL_AUDIO_PREFIX}${name}`;
      if (!this.files.has(key)) {
        this.files.add(key);
        changed = true;
      }
    }

    console.log(
      `[LocalFileIndex] ${this.files.size} audio files on device ` +
        `(${rootFiles.length} published, ${localFiles.length} pre-publish)`
    );
    if (changed) this.emit();
  }

  /** @param name relative name: '{uuid}.{ext}' or 'local/{uuid}.{ext}' */
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
