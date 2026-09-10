/**
 * Deterministic resolution of asset_content_link.audio values to local files.
 *
 * Audio values come in three shapes:
 *   - '{uuid}.{ext}'        storage object name (what the DB stores, including
 *                           on drafts). Until publish the file lives at
 *                           shared_attachments/local/{uuid}.{ext}.
 *   - 'local/{uuid}.{ext}'  on-disk staging path; also present in audio[]
 *                           on older published rows (storage object name).
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

/** True for on-disk staging paths (`local/{uuid}.{ext}`). */
export function isLocalOnlyAudio(audioValue: string): boolean {
  return audioValue.startsWith(LOCAL_AUDIO_PREFIX);
}

/**
 * True when this audio[] value can exist as a Supabase Storage object.
 * Older published rows still use a `local/…` object name; `file://` never does.
 */
export function isRemoteAudioObject(audioValue: string): boolean {
  return !isInvalidAudioValue(audioValue) && !audioValue.startsWith('file://');
}

/** Storage object name: strips the on-disk `local/` prefix. */
export function storageAudioObjectName(audioValue: string): string {
  return isLocalOnlyAudio(audioValue)
    ? audioValue.slice(LOCAL_AUDIO_PREFIX.length)
    : audioValue;
}

/** Strip `local/` from each audio[] value. Returns null when `audio` is not an array. */
export function normalizeStoredAudioArray(
  audio: unknown
): string[] | null {
  if (!Array.isArray(audio)) return null;
  return audio.map((value) =>
    typeof value === 'string' ? storageAudioObjectName(value) : String(value)
  );
}

/** True for values that can never resolve to a real attachment file. */
export function isInvalidAudioValue(audioValue: string): boolean {
  return audioValue.trim() === '' || audioValue.includes('blob:');
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
