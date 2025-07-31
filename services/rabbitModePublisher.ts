import { translationService } from '@/database_services/translationService';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import { RabbitModeFileManager } from '@/utils/rabbitModeFileManager';
import { eq } from 'drizzle-orm';

export interface PublishProgress {
    totalAssets: number;
    processedAssets: number;
    currentAssetName: string;
    totalSegments: number;
    processedSegments: number;
    isComplete: boolean;
    errors: string[];
}

export interface PublishResult {
    success: boolean;
    translationsCreated: number;
    segmentsProcessed: number;
    errors: string[];
}

export class RabbitModePublisher {
    /**
     * Publish a complete rabbit mode session to the database
     * @param sessionId - The session to publish
     * @param currentUserId - The current user's ID
     * @param onProgress - Optional progress callback
     * @returns Promise<PublishResult>
     */
    static async publishSession(
        sessionId: string,
        currentUserId: string,
        onProgress?: (progress: PublishProgress) => void
    ): Promise<PublishResult> {
        const session = useLocalStore.getState().getRabbitModeSession(sessionId);

        if (!session || session.isCommitted) {
            throw new Error('Session not found or already committed');
        }

        const assetsWithSegments = session.assets.filter(asset => asset.segments.length > 0);

        if (assetsWithSegments.length === 0) {
            throw new Error('No assets with recordings to publish');
        }

        console.log(`📦 Publishing session ${sessionId} with ${assetsWithSegments.length} assets`);

        const result: PublishResult = {
            success: false,
            translationsCreated: 0,
            segmentsProcessed: 0,
            errors: []
        };

        const totalSegments = assetsWithSegments.reduce((total, asset) => total + asset.segments.length, 0);
        let processedSegments = 0;

        try {
            // Get quest data to find project and target language
            const questData = await system.db.query.quest.findFirst({
                where: eq(quest.id, session.questId),
                with: {
                    project: true
                }
            });

            if (!questData?.project?.target_language_id) {
                throw new Error('Could not find target language for project');
            }

            console.log(`🎯 Publishing to project: ${questData.project.id}, target language: ${questData.project.target_language_id}`);

            // Process each asset that has segments
            let processedAssetCount = 0;
            for (const asset of assetsWithSegments) {
                console.log(`📝 Processing asset ${processedAssetCount + 1}/${assetsWithSegments.length}: ${asset.name}`);

                // Update progress
                onProgress?.({
                    totalAssets: assetsWithSegments.length,
                    processedAssets: processedAssetCount,
                    currentAssetName: asset.name,
                    totalSegments,
                    processedSegments,
                    isComplete: false,
                    errors: result.errors
                });

                try {
                    // Sort segments by order
                    const sortedSegments = [...asset.segments].sort((a, b) => a.order - b.order);

                    // Move all audio files to attachment queue
                    const audioAttachments: string[] = [];

                    for (const segment of sortedSegments) {
                        if (system.permAttachmentQueue && segment.audioUri) {
                            try {
                                console.log(`📎 Moving segment to attachment queue: ${segment.audioUri}`);
                                const attachment = await system.permAttachmentQueue.saveAudio(segment.audioUri);
                                audioAttachments.push(attachment.filename);
                                processedSegments++;

                                // Update progress for each segment
                                onProgress?.({
                                    totalAssets: assetsWithSegments.length,
                                    processedAssets: processedAssetCount,
                                    currentAssetName: asset.name,
                                    totalSegments,
                                    processedSegments,
                                    isComplete: false,
                                    errors: result.errors
                                });
                            } catch (segmentError) {
                                const errorMsg = `Failed to process segment for ${asset.name}: ${segmentError}`;
                                console.error('❌', errorMsg);
                                result.errors.push(errorMsg);
                            }
                        }
                    }

                    // Create translation record with all segments for this asset
                    if (audioAttachments.length > 0) {
                        console.log(`💾 Creating translation with ${audioAttachments.length} audio segments`);

                        const translation = await translationService.createTranslation({
                            text: null, // Audio-only translation
                            target_language_id: questData.project.target_language_id,
                            asset_id: asset.id,
                            creator_id: currentUserId,
                            audio_urls: audioAttachments
                        });

                        result.translationsCreated++;
                        result.segmentsProcessed += audioAttachments.length;

                        console.log(`✅ Translation created for ${asset.name}: ${translation.id}`);
                    } else {
                        const errorMsg = `No audio attachments created for asset: ${asset.name}`;
                        console.warn('⚠️', errorMsg);
                        result.errors.push(errorMsg);
                    }
                } catch (assetError) {
                    const errorMsg = `Failed to process asset ${asset.name}: ${assetError}`;
                    console.error('❌', errorMsg);
                    result.errors.push(errorMsg);
                }

                processedAssetCount++;
            }

            // Mark session as committed
            useLocalStore.getState().commitRabbitModeSession(sessionId);

            // Clean up session files after successful commit
            try {
                await RabbitModeFileManager.deleteSessionFiles(sessionId);
                console.log('🗑️ Session files cleaned up successfully');
            } catch (cleanupError) {
                console.warn('⚠️ Failed to clean up session files:', cleanupError);
                // Don't fail the whole operation for cleanup errors
            }

            // Remove from local store
            useLocalStore.getState().deleteRabbitModeSession(sessionId);

            result.success = result.translationsCreated > 0;

            // Final progress update
            onProgress?.({
                totalAssets: assetsWithSegments.length,
                processedAssets: assetsWithSegments.length,
                currentAssetName: '',
                totalSegments,
                processedSegments,
                isComplete: true,
                errors: result.errors
            });

            console.log(`✨ Publishing complete! Created ${result.translationsCreated} translations with ${result.segmentsProcessed} segments`);

            return result;
        } catch (error) {
            const errorMsg = `Publishing failed: ${error}`;
            console.error('❌', errorMsg);
            result.errors.push(errorMsg);
            result.success = false;

            // Final progress update with error
            onProgress?.({
                totalAssets: assetsWithSegments.length,
                processedAssets: 0,
                currentAssetName: '',
                totalSegments,
                processedSegments,
                isComplete: true,
                errors: result.errors
            });

            throw error;
        }
    }

    /**
     * Get a preview of what will be published
     * @param sessionId - The session to preview
     * @returns Summary of what will be published
     */
    static getPublishPreview(sessionId: string) {
        const session = useLocalStore.getState().getRabbitModeSession(sessionId);

        if (!session) {
            return null;
        }

        const assetsWithSegments = session.assets.filter(asset => asset.segments.length > 0);
        const totalSegments = assetsWithSegments.reduce((total, asset) => total + asset.segments.length, 0);

        return {
            sessionId,
            questId: session.questId,
            questName: session.questName,
            totalAssets: session.assets.length,
            assetsWithRecordings: assetsWithSegments.length,
            totalSegments,
            isCommitted: session.isCommitted,
            canPublish: assetsWithSegments.length > 0 && !session.isCommitted
        };
    }

    /**
     * Estimate the total storage size of a session
     * @param sessionId - The session to analyze
     * @returns Promise<number> - Size in bytes
     */
    static async getSessionStorageSize(sessionId: string): Promise<number> {
        try {
            const storageInfo = await RabbitModeFileManager.getSessionStorageInfo(sessionId);
            return storageInfo.totalSize;
        } catch (error) {
            console.error('Failed to get session storage size:', error);
            return 0;
        }
    }

    /**
     * Verify that all audio files exist before publishing
     * @param sessionId - The session to verify
     * @returns Promise<string[]> - Array of missing files
     */
    static async verifySessionFiles(sessionId: string): Promise<string[]> {
        const session = useLocalStore.getState().getRabbitModeSession(sessionId);

        if (!session) {
            return [];
        }

        const allAudioFiles: string[] = [];

        for (const asset of session.assets) {
            for (const segment of asset.segments) {
                allAudioFiles.push(segment.audioUri);
            }
        }

        return await RabbitModeFileManager.verifySessionFiles(sessionId, allAudioFiles);
    }
} 