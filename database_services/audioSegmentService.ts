import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system';
import { asset, asset_content_link, quest_asset_link } from '../db/drizzleSchema';
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
        creatorId: string
    ): Promise<{ assetId: string; audioUri: string }> {
        try {
            // Generate unique filename for the audio file
            const timestamp = Date.now();
            const audioId = `audio_${segment.id}_${timestamp}`;
            const audioFileName = `${audioId}.m4a`;

            // Get the document directory for permanent storage
            const documentDir = FileSystem.documentDirectory;
            if (!documentDir) {
                throw new Error('Document directory not available');
            }

            const audioDir = `${documentDir}audio/`;
            const audioUri = `${audioDir}${audioFileName}`;

            // Ensure audio directory exists
            const dirInfo = await FileSystem.getInfoAsync(audioDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
            }

            // Copy the recorded audio file to permanent storage
            await FileSystem.copyAsync({
                from: segment.uri,
                to: audioUri
            });

            // Create asset record in database
            const [newAsset] = await db
                .insert(asset)
                .values({
                    name: segment.name,
                    source_language_id: sourceLanguageId,
                    creator_id: creatorId,
                    visible: true,
                    download_profiles: [creatorId]
                })
                .returning();

            // Create asset content link with audio
            await db
                .insert(asset_content_link)
                .values({
                    asset_id: newAsset.id,
                    source_language_id: sourceLanguageId,
                    text: segment.name, // Use segment name as text content
                    audio_id: audioId,
                    download_profiles: [creatorId]
                });

            // Link asset to quest
            await db
                .insert(quest_asset_link)
                .values({
                    quest_id: questId,
                    asset_id: newAsset.id,
                    visible: true,
                    download_profiles: [creatorId]
                });

            return {
                assetId: newAsset.id,
                audioUri
            };
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
        creatorId: string
    ): Promise<{ assetIds: string[]; audioUris: string[] }> {
        const results = await Promise.allSettled(
            segments.map(segment =>
                this.saveAudioSegment(segment, questId, sourceLanguageId, creatorId)
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
                errors.push(`Failed to save segment ${segments[index]?.name}: ${result.reason}`);
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
                if (content.audio_id) {
                    const audioFileName = `${content.audio_id}.m4a`;
                    const audioUri = `${FileSystem.documentDirectory}audio/${audioFileName}`;
                    await FileSystem.deleteAsync(audioUri).catch(() => {
                        // Ignore errors if file doesn't exist
                    });
                }
            }

            // Delete database records
            await db.delete(asset_content_link).where(eq(asset_content_link.asset_id, assetId));
            await db.delete(quest_asset_link).where(eq(quest_asset_link.asset_id, assetId));
            await db.delete(asset).where(eq(asset.id, assetId));
        } catch (error) {
            console.error('Failed to delete audio segment:', error);
            throw error;
        }
    }
}

export const audioSegmentService = new AudioSegmentService();

