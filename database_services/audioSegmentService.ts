import { resolveTable } from '@/utils/dbUtils';
import { saveAudioLocally } from '@/utils/fileUtils';
import { eq } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import { asset_content_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export interface AudioSegmentData {
  id: string;
  uri: string;
  duration: number;
  waveformData: number[];
  name: string;
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
   * Delete audio segment and associated files
   */
  async deleteAudioSegment(assetId: string): Promise<void> {
    try {
      // Get asset content to find audio file
      const assetContent = await db
        .select()
        .from(asset_content_link)
        .where(eq(asset_content_link.asset_id, assetId));

      // Delete audio files
      for (const content of assetContent) {
        if (content.audio) {
          for (const audio of content.audio) {
            await system.permAttachmentQueue?.deleteFromQueue(audio);
          }
        }
      }

      const resolvedAsset = resolveTable('asset', { localOverride: true });
      const resolvedAssetContent = resolveTable('asset_content_link', {
        localOverride: true
      });
      const resolvedQuestAssetLink = resolveTable('quest_asset_link', {
        localOverride: true
      });

      await system.db
        .delete(resolvedAsset)
        .where(eq(resolvedAsset.id, assetId));
      await system.db
        .delete(resolvedAssetContent)
        .where(eq(resolvedAssetContent.asset_id, assetId));
      await system.db
        .delete(resolvedQuestAssetLink)
        .where(eq(resolvedQuestAssetLink.asset_id, assetId));
    } catch (error) {
      console.error('Failed to delete audio segment:', error);
      throw error;
    }
  }
}

export const audioSegmentService = new AudioSegmentService();
