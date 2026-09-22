/**
 * Deterministic resolution of asset_content_link.audio values to local files.
 *
 * Audio values come in three shapes:
 *   - '{uuid}.{ext}'        storage object name (what the DB stores). The file
 *                           lives at shared_attachments/{uuid}.{ext} from the
 *                           moment it is recorded.
 *   - 'local/{uuid}.{ext}'  legacy: pre-2.6 published rows stored the on-disk
 *                           staging path, and that string is also their
 *                           storage object name. On disk the file is at
 *                           shared_attachments/{uuid}.{ext} (2.7 folds the
 *                           old local/ folder into the root at startup).
 *   - 'file://…'            legacy full URI stored by very old clients
 *
 * There is no database involved: the on-disk location is a pure function of
 * the value (`localAudioFileName`).
 */

import {
  fileExists,
  getFileName,
  getLocalAttachmentUri,
  getLocalAttachmentUriWithOPFS
} from '@/utils/fileUtils';

export const LOCAL_AUDIO_PREFIX = 'local/';

/** True for legacy `local/{uuid}.{ext}` values. */
function isLocalOnlyAudio(audioValue: string): boolean {
  return audioValue.startsWith(LOCAL_AUDIO_PREFIX);
}

/**
 * True when this audio[] value can exist as a Supabase Storage object.
 * Older published rows still use a `local/…` object name; `file://` never does.
 */
export function isRemoteAudioObject(audioValue: string): boolean {
  return !isInvalidAudioValue(audioValue) && !audioValue.startsWith('file://');
}

/** Storage object name as the *server* knows it: strips the legacy `local/` prefix. */
export function storageAudioObjectName(audioValue: string): string {
  return isLocalOnlyAudio(audioValue)
    ? audioValue.slice(LOCAL_AUDIO_PREFIX.length)
    : audioValue;
}

/**
 * Bare filename under shared_attachments/ for an audio[] value: the value
 * itself, minus any legacy `local/` prefix or `file://` directory part.
 */
export function localAudioFileName(audioValue: string): string {
  if (audioValue.startsWith('file://')) {
    return getFileName(audioValue) ?? audioValue;
  }
  return storageAudioObjectName(audioValue);
}

/** Strip `local/` from each audio[] value. Returns null when `audio` is not an array. */
export function normalizeStoredAudioArray(audio: unknown): string[] | null {
  if (!Array.isArray(audio)) return null;
  return audio.map((value) =>
    typeof value === 'string' ? storageAudioObjectName(value) : String(value)
  );
}

/** True for values that can never resolve to a real attachment file. */
function isInvalidAudioValue(audioValue: string): boolean {
  return audioValue.trim() === '' || audioValue.includes('blob:');
}

/**
 * Resolve an audio value to a playable local URI, returning null when the
 * file is not on this device.
 *
 * Checks the flat location first, then the legacy `local/` staging folder
 * (only populated if the 2.7 startup migration could not move a file).
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

  const name = localAudioFileName(audioValue);
  const candidates = [name, `${LOCAL_AUDIO_PREFIX}${name}`];

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
