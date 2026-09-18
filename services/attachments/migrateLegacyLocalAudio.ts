/**
 * One-time cleanup of the pre-2.7 `shared_attachments/local/` staging folder.
 *
 * Older builds recorded into `local/{uuid}.{ext}` and only moved the file to
 * `shared_attachments/{uuid}.{ext}` when the quest was published. Audio now
 * uploads as soon as it is recorded, so there is a single flat directory and
 * every file lives at its storage object name. This moves any leftovers up
 * one level so the uploader/downloader/resolver see them without special
 * cases.
 *
 * Idempotent and tolerant: a file that fails to move stays where it is, and
 * `resolveExistingAudioUri` still falls back to the `local/` location.
 */

import { LOCAL_AUDIO_PREFIX } from '@/utils/attachmentPaths';
import {
  SHARED_ATTACHMENTS_DIRECTORY,
  deleteIfExists,
  ensureDir,
  fileExists,
  getLocalAttachmentUri,
  getLocalUri,
  listDirectoryFilenames,
  moveFile
} from '@/utils/fileUtils';

export interface LegacyLocalAudioMigrationResult {
  moved: number;
  /** Source removed because the same filename already existed at the root. */
  duplicates: number;
  failed: number;
}

export async function migrateLegacyLocalAudioDirectory(): Promise<LegacyLocalAudioMigrationResult> {
  const result: LegacyLocalAudioMigrationResult = {
    moved: 0,
    duplicates: 0,
    failed: 0
  };

  const legacyDir = getLocalUri(
    `${SHARED_ATTACHMENTS_DIRECTORY}/${LOCAL_AUDIO_PREFIX}`
  );
  const names = await listDirectoryFilenames(legacyDir);
  if (names.length === 0) return result;

  console.log(
    `[migrateLegacyLocalAudio] Moving ${names.length} file(s) out of ${LOCAL_AUDIO_PREFIX}`
  );

  // The awaited fileUtils functions are platform-split: sync on native (the
  // typings TS sees here), async on web — the awaits are required on web.
  /* eslint-disable @typescript-eslint/await-thenable */
  const rootDir = getLocalUri(SHARED_ATTACHMENTS_DIRECTORY);
  await ensureDir(rootDir);

  for (const name of names) {
    const sourceUri = getLocalAttachmentUri(`${LOCAL_AUDIO_PREFIX}${name}`);
    const targetUri = getLocalAttachmentUri(name);
    try {
      if (await fileExists(targetUri)) {
        // Publish already promoted this file (or a download landed first).
        // Filenames are UUIDs, so same name means same content.
        await deleteIfExists(sourceUri);
        result.duplicates++;
        continue;
      }
      await moveFile(sourceUri, targetUri);
      result.moved++;
    } catch (error) {
      result.failed++;
      console.warn(
        `[migrateLegacyLocalAudio] Failed to move ${name}; leaving in place`,
        error
      );
    }
  }

  if (result.failed === 0) {
    try {
      // Native removes the now-empty directory; on web deleteIfExists cannot
      // address a directory and an empty local/ folder is harmless.
      await deleteIfExists(legacyDir);
    } catch {
      // Ignore: an empty leftover folder is harmless.
    }
  }
  /* eslint-enable @typescript-eslint/await-thenable */

  console.log(
    `[migrateLegacyLocalAudio] moved=${result.moved} duplicates=${result.duplicates} failed=${result.failed}`
  );
  return result;
}
