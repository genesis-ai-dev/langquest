/**
 * Promote an audio file to its published location.
 *
 * Replaces the old queue's `saveAudio`: moves the file to
 * shared_attachments/{filename} and nothing else. No record is created —
 * the AudioUploader derives its work list from asset_content_link rows, so
 * the row referencing this filename (with audio_uploaded_at still null) IS
 * the enqueue.
 */

import { LOCAL_AUDIO_PREFIX } from '@/utils/attachmentPaths';
import {
  ensureDir,
  fileExists,
  getDirectory,
  getFileName,
  getLocalAttachmentUri,
  moveFile
} from '@/utils/fileUtils';
import { localFileIndex } from './LocalFileIndex';

/**
 * @param sourceUri full URI (or path) of the file; its basename becomes the
 *   published filename, matching the acl rewrite that strips 'local/'.
 * @returns the published filename ('{uuid}.{ext}')
 */
export async function promoteLocalAudio(sourceUri: string): Promise<string> {
  if (sourceUri.includes('blob:')) {
    throw new Error(
      'Cannot promote a blob URL. Save it to a file first (saveAudioLocally).'
    );
  }

  const filename = getFileName(sourceUri);
  if (!filename) {
    throw new Error(`Cannot derive a filename from: ${sourceUri}`);
  }

  const targetUri = getLocalAttachmentUri(filename);

  // The awaited fileUtils functions are platform-split: sync on native (the
  // typings TS sees here), async on web — the awaits are required on web.
  /* eslint-disable @typescript-eslint/await-thenable */
  if (await fileExists(sourceUri)) {
    await ensureDir(getDirectory(targetUri));
    await moveFile(sourceUri, targetUri);
    localFileIndex.add(filename);
    return filename;
  }

  if (await fileExists(targetUri)) {
    // Already promoted (e.g. publish retried after an interruption).
    localFileIndex.add(filename);
    return filename;
  }
  /* eslint-enable @typescript-eslint/await-thenable */

  // Match the old saveAudio behavior: reference the filename anyway so the
  // rest of publish proceeds; the missing file surfaces as a pending upload
  // (visible) instead of failing the whole publish.
  console.warn(
    `[promoteLocalAudio] Source file missing: ${sourceUri} (continuing; will show as pending upload)`
  );
  return filename;
}

/** Convenience for values shaped like 'local/{uuid}.{ext}'. */
export async function promoteLocalAudioValue(
  audioValue: string
): Promise<string> {
  const relative = audioValue.startsWith(LOCAL_AUDIO_PREFIX)
    ? audioValue
    : `${LOCAL_AUDIO_PREFIX}${audioValue}`;
  return promoteLocalAudio(getLocalAttachmentUri(relative));
}
