import { resolveTable } from '@/utils/dbUtils';
import { saveAudioLocally } from '@/utils/fileUtils';
import { eq } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import { asset_content_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;
type LocalDbTx = Parameters<Parameters<typeof system.db.transaction>[0]>[0];

export interface AudioSegmentData {
  id: string;
  uri: string;
  duration: number;
  waveformData: number[];
  name: string;
}

/**
 * Resolve local asset IDs to delete for a given root asset:
 * immediate children first, then root.
 */
export async function getLocalAssetCascadeIds(
  assetId: string
): Promise<string[]> {
  const resolvedAsset = resolveTable('asset', { localOverride: true });
  const childAssets = await system.db
    .select({ id: resolvedAsset.id })
    .from(resolvedAsset)
    .where(eq(resolvedAsset.source_asset_id, assetId));

  return [...childAssets.map((c) => c.id), assetId];
}

/**
 * Delete all local DB rows tied to each asset ID, in-place.
 * Order is caller-controlled; children should be deleted before parents.
 */
export async function deleteLocalAssetRecordsInTx(
  tx: LocalDbTx,
  assetIds: string[]
): Promise<void> {
  const resolvedAsset = resolveTable('asset', { localOverride: true });
  const resolvedAssetContent = resolveTable('asset_content_link', {
    localOverride: true
  });
  const resolvedQuestAssetLink = resolveTable('quest_asset_link', {
    localOverride: true
  });
  const resolvedVote = resolveTable('vote', { localOverride: true });
  const resolvedAssetTagLink = resolveTable('asset_tag_link', {
    localOverride: true
  });

  for (const currentAssetId of assetIds) {
    await tx.delete(resolvedVote).where(eq(resolvedVote.asset_id, currentAssetId));
    await tx
      .delete(resolvedAssetTagLink)
      .where(eq(resolvedAssetTagLink.asset_id, currentAssetId));
    await tx
      .delete(resolvedQuestAssetLink)
      .where(eq(resolvedQuestAssetLink.asset_id, currentAssetId));
    await tx
      .delete(resolvedAssetContent)
      .where(eq(resolvedAssetContent.asset_id, currentAssetId));
    await tx.delete(resolvedAsset).where(eq(resolvedAsset.id, currentAssetId));
  }
}

export class AudioSegmentService {
  /**
   * Save audio segment to device storage and create asset record
   */
  async saveAudioSegment(
    segment: AudioSegmentData,
    questId: string,
    sourceLanguageId: string,
    creatorId: string,
    projectId: string
  ): Promise<{ assetId: string; audioUri: string }> {
    try {
      // Save the recorded audio via the permanent attachment queue
      if (!system.permAttachmentQueue) {
        throw new Error('Permanent attachment queue not initialized');
      }

      const localUri = await saveAudioLocally(segment.uri);

      console.log('[AUDIO SEGMENT SERVICE] Local URI:', localUri);

      // const attachment = await system.permAttachmentQueue.saveAudio(
      //   segment.uri
      // );

      const newAsset = await system.db.transaction(async (tx) => {
        const [newAsset] = await tx
          .insert(resolveTable('asset', { localOverride: true }))
          .values({
            name: segment.name,
            id: segment.id,
            source_language_id: sourceLanguageId,
            creator_id: creatorId,
            project_id: projectId,
            download_profiles: [creatorId]
          })
          .returning();

        if (!newAsset) {
          throw new Error('Failed to insert asset');
        }

        // Generate proper UUID for link table (not string concatenation)
        await tx
          .insert(resolveTable('quest_asset_link', { localOverride: true }))
          .values({
            id: String(uuid.v4()),
            quest_id: questId,
            asset_id: newAsset.id,
            download_profiles: [creatorId]
          });

        // TODO: only publish the audio to the supabase storage bucket once the user hits publish (store locally only right now)

        await tx
          .insert(resolveTable('asset_content_link', { localOverride: true }))
          .values({
            asset_id: newAsset.id,
            source_language_id: sourceLanguageId,
            text: segment.name,
            // Link to the local file path (localUri already includes 'local/' prefix from saveAudioLocally)
            audio: [localUri],
            download_profiles: [creatorId]
          });

        return newAsset;
      });

      return { assetId: newAsset.id, audioUri: localUri };
    } catch (error) {
      console.error('Failed to save audio segment:', error);
      throw error;
    }
  }

  /**
   * Save multiple audio segments as a batch
   */
  async saveAudioSegments(
    segments: AudioSegmentData[],
    questId: string,
    sourceLanguageId: string,
    creatorId: string,
    projectId: string
  ): Promise<{ assetIds: string[]; audioUris: string[] }> {
    const results = await Promise.allSettled(
      segments.map((segment) =>
        this.saveAudioSegment(
          segment,
          questId,
          sourceLanguageId,
          creatorId,
          projectId
        )
      )
    );

    const assetIds: string[] = [];
    const audioUris: string[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        assetIds.push(result.value.assetId);
        audioUris.push(result.value.audioUri);
      } else {
        errors.push(
          `Failed to save segment ${segments[index]?.name}: ${result.reason}`
        );
      }
    });

    if (errors.length > 0) {
      console.warn('Some audio segments failed to save:', errors);
    }

    return { assetIds, audioUris };
  }

  /**
   * Delete audio segment and all associated records (including child translations)
   *
   * Deletion order (children before parents to maintain referential integrity):
   * 1. Find all child assets (translations/transcriptions with source_asset_id = this asset)
   * 2. For each child asset: delete votes, asset_tag_links, quest_asset_links, asset_content_links, then the asset
   * 3. For the parent asset: delete votes, asset_tag_links, quest_asset_links, asset_content_links, then the asset
   *
   * @param assetId - The ID of the asset to delete
   * @param options.preserveAudioFiles - If true, skip deleting audio files from attachment queue.
   *   Use this when merging assets, where audio files are being transferred to another asset.
   */
  async deleteAudioSegment(
    assetId: string,
    options?: { preserveAudioFiles?: boolean }
  ): Promise<void> {
    const { preserveAudioFiles = false } = options ?? {};
    try {
      // Collect all asset IDs to delete (children + parent)
      const allAssetIds = await getLocalAssetCascadeIds(assetId);

      // Collect audio files to delete from attachment queue BEFORE transaction
      const allAssetContent = await db
        .select()
        .from(asset_content_link)
        .where(eq(asset_content_link.asset_id, assetId));

      // Also get content from child assets
      for (const childId of allAssetIds.slice(0, -1)) {
        const childContent = await db
          .select()
          .from(asset_content_link)
          .where(eq(asset_content_link.asset_id, childId));
        allAssetContent.push(...childContent);
      }

      // Delete audio files from queue (file system ops, outside transaction)
      // SKIP if preserveAudioFiles is true (used during merge when audio is being transferred)
      if (!preserveAudioFiles) {
        for (const content of allAssetContent) {
          if (content.audio) {
            for (const audio of content.audio) {
              await system.permAttachmentQueue?.deleteFromQueue(audio);
            }
          }
        }
      } else {
        console.log(
          `⏭️ Preserving ${allAssetContent.length} audio files (merge operation)`
        );
      }

      await system.db.transaction(async (tx) => {
        await deleteLocalAssetRecordsInTx(tx, allAssetIds);
      });

      console.log(
        `✅ Deleted asset ${assetId.slice(0, 8)} and ${Math.max(0, allAssetIds.length - 1)} child assets`
      );
    } catch (error) {
      console.error('Failed to delete audio segment:', error);
      throw error;
    }
  }
}

export const audioSegmentService = new AudioSegmentService();
