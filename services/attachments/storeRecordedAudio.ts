/**
 * Persist a freshly recorded audio file and make it visible to the uploader.
 *
 * Moves the recorder's temp file (or web blob) into shared_attachments/ under
 * a fresh `{uuid}.{ext}` name and registers that name in the LocalFileIndex.
 * The returned name is what goes into asset_content_link.audio[]: it is both
 * the on-disk filename and the Supabase Storage object name.
 *
 * No queue record is created. The AudioUploader derives its work list from
 * asset_content_link rows whose audio_uploaded_at is still null, so inserting
 * the row that references this filename IS the enqueue — and, since 2.7,
 * uploads start immediately regardless of whether the quest is published.
 */

import { saveAudioLocally } from '@/utils/fileUtils';
import { localFileIndex } from './LocalFileIndex';

/**
 * @param sourceUri recorder output: a `file://` URI on native, a `blob:` URL
 *   on web.
 * @returns the stored filename ('{uuid}.{ext}')
 */
export async function storeRecordedAudio(sourceUri: string): Promise<string> {
  const filename = await saveAudioLocally(sourceUri);
  localFileIndex.add(filename);
  return filename;
}
