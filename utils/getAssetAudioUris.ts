import { system } from '@/db/powersync/system';
import { collectAudioValues } from '@/utils/collectAudioValues';
import { resolveTable } from '@/utils/dbUtils';
import { resolvePlayableAudioUri } from '@/utils/resolvePlayableAudio';
import { eq } from 'drizzle-orm';

async function loadLocalAudioValues(assetId: string): Promise<string[]> {
  const assetContentLinkTable = resolveTable('asset_content_link');
  const links = await system.db
    .select()
    .from(assetContentLinkTable)
    .where(eq(assetContentLinkTable.asset_id, assetId));
  return collectAudioValues(links);
}

async function loadCloudAudioValues(assetId: string): Promise<string[]> {
  const { data, error } = await system.supabaseConnector.client
    .from('asset_content_link')
    .select('audio')
    .eq('asset_id', assetId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch cloud asset content:', error);
    return [];
  }

  return collectAudioValues(data);
}

/**
 * Playable URIs for an asset: local SQLite content first, then published
 * cloud rows (guest browse / not-yet-downloaded quests).
 */
export async function getAssetAudioUris(assetId: string): Promise<string[]> {
  try {
    let audioValues = await loadLocalAudioValues(assetId);
    if (audioValues.length === 0) {
      audioValues = await loadCloudAudioValues(assetId);
    }

    const uris: string[] = [];
    for (const audioValue of audioValues) {
      const uri = await resolvePlayableAudioUri(audioValue);
      if (uri) uris.push(uri);
    }
    return uris;
  } catch (error) {
    console.error('Failed to fetch audio URIs:', error);
    return [];
  }
}
