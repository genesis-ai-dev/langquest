import { AppConfig } from '@/db/supabase/AppConfig';
import { system } from '@/db/powersync/system';
import {
  isRemoteAudioObject,
  resolveExistingAudioUri
} from '@/utils/attachmentPaths';

/**
 * Playable URI for an audio[] value: on-disk file first, then the storage
 * object of the same name (including legacy `local/…` keys).
 */
export async function resolvePlayableAudioUri(
  audioValue: string
): Promise<string | null> {
  const localUri = await resolveExistingAudioUri(audioValue);
  if (localUri) return localUri;

  if (!isRemoteAudioObject(audioValue) || !AppConfig.supabaseBucket) {
    console.warn(`Local audio file not found: ${audioValue}`);
    return null;
  }

  try {
    const { data } = system.supabaseConnector.client.storage
      .from(AppConfig.supabaseBucket)
      .getPublicUrl(audioValue);
    return data.publicUrl || null;
  } catch (error) {
    console.error('Failed to get cloud audio URL:', error);
    return null;
  }
}
