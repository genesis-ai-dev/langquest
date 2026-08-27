/**
 * Deterministic resolution of asset_content_link.audio values to local files.
 *
 * Audio values come in three shapes:
 *   - 'local/{uuid}.{ext}'  pre-publish recording (stays on-device by design)
 *   - '{uuid}.{ext}'        published filename; local copy lives at
 *                           shared_attachments/{uuid}.{ext}
 *   - 'file://…'            legacy full URI stored by very old clients
 *
 * There is no database involved: the on-disk location is a pure function of
 * the value. (The old attachment queue's `local_uri` column was always
 * `shared_attachments/{filename}`, so this is behavior-identical to the old
 * table lookup.)
 */

import {
  fileExists,
  getFileName,
  getLocalAttachmentUri,
  getLocalAttachmentUriWithOPFS
} from '@/utils/fileUtils';

export const LOCAL_AUDIO_PREFIX = 'local/';

/** True for pre-publish values that must never be uploaded. */
export function isLocalOnlyAudio(audioValue: string): boolean {
  return audioValue.startsWith(LOCAL_AUDIO_PREFIX);
}

/** True for values that can never resolve to a real attachment file. */
export function isInvalidAudioValue(audioValue: string): boolean {
  return audioValue.trim() === '' || audioValue.includes('blob:');
}

/**
 * The playable local URI for an audio value, without checking existence.
 * On web this returns an OPFS blob URL and throws if the file is missing;
 * prefer resolveExistingAudioUri unless you already know the file exists.
 */
export async function resolveAudioUri(audioValue: string): Promise<string> {
  if (audioValue.startsWith('file://')) return audioValue;
  return getLocalAttachmentUriWithOPFS(audioValue);
}

/**
 * Resolve an audio value to a playable local URI, returning null when the
 * file is not on this device.
 *
 * Checks the value's canonical location first, then the counterpart location
 * (a `local/…` value whose file was already promoted at publish, or a bare
 * filename whose file has not been promoted yet). This covers the states a
 * publish interruption can leave behind.
 */
export async function resolveExistingAudioUri(
  audioValue: string
): Promise<string | null> {
  if (isInvalidAudioValue(audioValue)) return null;

  if (audioValue.startsWith('file://')) {
    // eslint-disable-next-line @typescript-eslint/await-thenable -- fileExists is platform-split: sync on native (typed here), async on web
    if (await fileExists(audioValue)) return audioValue;
    const filename = getFileName(audioValue);
    return filename ? resolveExistingAudioUri(filename) : null;
  }

  const candidates = isLocalOnlyAudio(audioValue)
    ? [audioValue, audioValue.slice(LOCAL_AUDIO_PREFIX.length)]
    : [audioValue, `${LOCAL_AUDIO_PREFIX}${audioValue}`];

  for (const candidate of candidates) {
    // Existence is checked on the raw path (cheap on both platforms) before
    // materializing the playable URI (which creates a blob URL on web).
    // eslint-disable-next-line @typescript-eslint/await-thenable -- fileExists is platform-split: sync on native (typed here), async on web
    if (await fileExists(getLocalAttachmentUri(candidate))) {
      return getLocalAttachmentUriWithOPFS(candidate);
    }
  }

  return null;
}
