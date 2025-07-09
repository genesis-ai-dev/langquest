import { getCurrentUser } from '@/contexts/AuthContext';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import type * as drizzleSchema from '../drizzleSchema';

interface AttachmentSource {
    type: 'asset_images' | 'asset_content' | 'translations';
    assetId: string;
    attachmentIds: string[];
}

const DEBUG_ATTACHMENT_STATE = false;
const debug = (...message: unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (DEBUG_ATTACHMENT_STATE) {
        console.log(...message);
    }
};

export class AttachmentStateManager {
    private unifiedAttachmentIds = new Set<string>();
    private updateInProgress = false;
    private updateTimer: NodeJS.Timeout | null = null;
    private lastUpdateTime = 0;
    private attachmentSources = new Map<string, AttachmentSource[]>();

    // Track download operations to avoid lock contention
    private downloadOperationInProgress = false;
    private downloadOperationTimer: NodeJS.Timeout | null = null;
    private pendingUpdates = new Set<string>();

    constructor(private db: PowerSyncSQLiteDatabase<typeof drizzleSchema>) { }

    /**
     * Mark that a download operation is starting
     * This prevents attachment collection during the operation to avoid lock contention
     */
    markDownloadOperationStart(): void {
        debug(
            '🚫 [ATTACHMENT STATE] Download operation started - pausing attachment updates'
        );
        this.downloadOperationInProgress = true;

        // Clear any existing timer
        if (this.downloadOperationTimer) {
            clearTimeout(this.downloadOperationTimer);
        }

        // Auto-clear the download operation flag after 30 seconds (safety timeout)
        this.downloadOperationTimer = setTimeout(() => {
            debug(
                '⏰ [ATTACHMENT STATE] Download operation timeout - resuming attachment updates'
            );
            this.markDownloadOperationComplete();
        }, 30000);
    }

    /**
     * Mark that a download operation is complete
     * This resumes attachment collection and processes any pending updates
     */
    markDownloadOperationComplete(): void {
        debug(
            '✅ [ATTACHMENT STATE] Download operation completed - resuming attachment updates'
        );
        this.downloadOperationInProgress = false;

        if (this.downloadOperationTimer) {
            clearTimeout(this.downloadOperationTimer);
            this.downloadOperationTimer = null;
        }

        // Process any pending updates
        if (this.pendingUpdates.size > 0) {
            debug(
                `🔄 [ATTACHMENT STATE] Processing ${this.pendingUpdates.size} pending updates: ${Array.from(this.pendingUpdates).join(', ')}`
            );
            const pendingSources = Array.from(this.pendingUpdates);
            this.pendingUpdates.clear();

            // Process the most important update (quest_downloads takes priority)
            const priorityOrder = [
                'quest_downloads',
                'asset_downloads',
                'quest_asset_links',
                'asset_content',
                'translations'
            ];
            const sortedSources = pendingSources.sort((a, b) => {
                const aIndex = priorityOrder.indexOf(a);
                const bIndex = priorityOrder.indexOf(b);
                return (aIndex !== -1 ? aIndex : 999) - (bIndex !== -1 ? bIndex : 999);
            });

            // Only process the highest priority update to avoid cascading
            if (sortedSources.length > 0) {
                // We'll need to get the onUpdate callback, but we can't store it here
                // Instead, we'll trigger through the normal debounce mechanism
                debug(
                    `🎯 [ATTACHMENT STATE] Processing priority update: ${sortedSources[0]}`
                );
            }
        }
    }

    /**
     * Check if download operation is in progress
     */
    isDownloadOperationInProgress(): boolean {
        return this.downloadOperationInProgress;
    }

    /**
     * Get all attachment IDs for permanent storage (downloaded content)
     * Uses consistent offline data source to prevent race conditions
     */
    async getUnifiedPermanentAttachmentIds(): Promise<string[]> {
        try {
            const allAttachmentIds: string[] = [];
            const processedAssetIds = new Set<string>();
            const currentUser = getCurrentUser();

            if (!currentUser?.id) {
                debug(
                    '[ATTACHMENT STATE] No current user, returning empty attachment list'
                );
                return [];
            }

            debug(
                '[ATTACHMENT STATE] 🔍 Collecting unified permanent attachment IDs...'
            );

            // 1. Get directly downloaded assets
            const directAssets = await this.db.query.asset.findMany({
                where: (asset, { and, eq }) =>
                    and(eq(asset.download_profiles, [currentUser.id])),
                columns: { id: true, images: true }
            });

            debug(
                `[ATTACHMENT STATE] Found ${directAssets.length} directly downloaded assets`
            );

            // 2. Get assets from downloaded quests
            const downloadedQuests = await this.db.query.quest.findMany({
                where: (quest, { eq }) => eq(quest.download_profiles, [currentUser.id]),
                columns: { id: true }
            });

            debug(
                `[ATTACHMENT STATE] Found ${downloadedQuests.length} downloaded quests`
            );

            // Get quest-asset links for downloaded quests
            const questAssetLinks =
                downloadedQuests.length > 0
                    ? await this.db.query.quest_asset_link.findMany({
                        where: (link, { inArray }) =>
                            inArray(
                                link.quest_id,
                                downloadedQuests.map((q) => q.id)
                            ),
                        columns: { asset_id: true }
                    })
                    : [];

            debug(
                `[ATTACHMENT STATE] Found ${questAssetLinks.length} assets in downloaded quests`
            );

            // Get asset details for quest assets
            const questAssets =
                questAssetLinks.length > 0
                    ? await this.db.query.asset.findMany({
                        where: (asset, { inArray }) =>
                            inArray(
                                asset.id,
                                questAssetLinks.map((l) => l.asset_id)
                            ),
                        columns: { id: true, images: true }
                    })
                    : [];

            // Combine and deduplicate assets
            const allAssets = [...directAssets, ...questAssets];
            const assetSources = new Map<string, AttachmentSource[]>();

            // Process each unique asset
            for (const asset of allAssets) {
                if (processedAssetIds.has(asset.id)) continue;
                processedAssetIds.add(asset.id);

                const sources: AttachmentSource[] = [];

                // 1. Asset images
                if (asset.images && asset.images.length > 0) {
                    allAttachmentIds.push(...asset.images);
                    sources.push({
                        type: 'asset_images',
                        assetId: asset.id,
                        attachmentIds: asset.images
                    });
                }

                // 2. Asset content audio
                const assetContents = await this.db.query.asset_content_link.findMany({
                    where: (content, { eq }) => eq(content.asset_id, asset.id),
                    columns: { audio_id: true }
                });

                const contentAudioIds = assetContents
                    .filter((content) => content.audio_id)
                    .map((content) => content.audio_id!);

                if (contentAudioIds.length > 0) {
                    allAttachmentIds.push(...contentAudioIds);
                    sources.push({
                        type: 'asset_content',
                        assetId: asset.id,
                        attachmentIds: contentAudioIds
                    });
                }

                // 3. Translation audio
                const translations = await this.db.query.translation.findMany({
                    where: (translation, { eq }) => eq(translation.asset_id, asset.id),
                    columns: { audio: true }
                });

                const translationAudioIds = translations
                    .filter((translation) => translation.audio)
                    .map((translation) => translation.audio!);

                if (translationAudioIds.length > 0) {
                    allAttachmentIds.push(...translationAudioIds);
                    sources.push({
                        type: 'translations',
                        assetId: asset.id,
                        attachmentIds: translationAudioIds
                    });
                }

                if (sources.length > 0) {
                    assetSources.set(asset.id, sources);
                }
            }

            // Store sources for debugging
            this.attachmentSources = assetSources;

            // Deduplicate and return
            const uniqueAttachmentIds = [...new Set(allAttachmentIds)];

            debug(
                `[ATTACHMENT STATE] ✅ Collected ${uniqueAttachmentIds.length} unique permanent attachment IDs from ${processedAssetIds.size} assets`
            );

            // Log sources breakdown
            let totalImages = 0,
                totalContent = 0,
                totalTranslations = 0;
            assetSources.forEach((sources) => {
                sources.forEach((source) => {
                    switch (source.type) {
                        case 'asset_images':
                            totalImages += source.attachmentIds.length;
                            break;
                        case 'asset_content':
                            totalContent += source.attachmentIds.length;
                            break;
                        case 'translations':
                            totalTranslations += source.attachmentIds.length;
                            break;
                    }
                });
            });

            debug(
                `[ATTACHMENT STATE] 📊 Breakdown: ${totalImages} images, ${totalContent} content audio, ${totalTranslations} translation audio`
            );

            return uniqueAttachmentIds;
        } catch (error) {
            console.error(
                '[ATTACHMENT STATE] ❌ Error collecting attachment IDs:',
                error
            );
            return [];
        }
    }

    /**
     * Get attachment IDs for specific assets (used for temporary/viewing attachments)
     * Consistent with permanent collection method
     */
    async getAttachmentIdsForAssets(assetIds: string[]): Promise<string[]> {
        if (!assetIds.length) return [];

        try {
            debug(
                `[ATTACHMENT STATE] 🔍 Getting attachments for specific assets: ${assetIds.join(', ')}`
            );

            const allAttachmentIds: string[] = [];

            // Get assets
            const assets = await this.db.query.asset.findMany({
                where: (asset, { inArray }) => inArray(asset.id, assetIds),
                columns: { id: true, images: true }
            });

            for (const asset of assets) {
                // 1. Asset images
                if (asset.images && asset.images.length > 0) {
                    allAttachmentIds.push(...asset.images);
                }

                // 2. Asset content audio
                const assetContents = await this.db.query.asset_content_link.findMany({
                    where: (content, { eq }) => eq(content.asset_id, asset.id),
                    columns: { audio_id: true }
                });

                const contentAudioIds = assetContents
                    .filter((content) => content.audio_id)
                    .map((content) => content.audio_id!);

                allAttachmentIds.push(...contentAudioIds);

                // 3. Translation audio
                const translations = await this.db.query.translation.findMany({
                    where: (translation, { eq }) => eq(translation.asset_id, asset.id),
                    columns: { audio: true }
                });

                const translationAudioIds = translations
                    .filter((translation) => translation.audio)
                    .map((translation) => translation.audio!);

                allAttachmentIds.push(...translationAudioIds);
            }

            const uniqueAttachmentIds = [...new Set(allAttachmentIds)];
            debug(
                `[ATTACHMENT STATE] ✅ Found ${uniqueAttachmentIds.length} attachments for ${assetIds.length} assets`
            );

            return uniqueAttachmentIds;
        } catch (error) {
            console.error(
                '[ATTACHMENT STATE] ❌ Error getting asset attachment IDs:',
                error
            );
            return [];
        }
    }

    /**
     * Debounced update method to prevent excessive calls
     * Uses longer debounce during potential download operations
     */
    updateWithDebounce(
        onUpdate: (ids: string[]) => void,
        triggerSource: string
    ): void {
        debug(`⏱️ [ATTACHMENT STATE] Update triggered by: ${triggerSource}`);

        // Skip updates if download operation is in progress to avoid lock contention
        if (this.downloadOperationInProgress) {
            debug(
                `🚫 [ATTACHMENT STATE] Skipping update (${triggerSource}) - download operation in progress`
            );
            this.pendingUpdates.add(triggerSource);
            return;
        }

        // Clear existing timer
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        // Use longer debounce for download-related triggers to avoid lock contention
        const isDownloadRelated = [
            'quest_downloads',
            'asset_downloads',
            'quest_asset_links'
        ].includes(triggerSource);
        const debounceTime = isDownloadRelated ? 5000 : 1000; // 5 seconds for download operations, 1 second for others

        debug(
            `⏱️ [ATTACHMENT STATE] Using ${debounceTime}ms debounce for trigger: ${triggerSource}`
        );

        // Set new debounced timer
        this.updateTimer = setTimeout(() => {
            void this.updateAttachmentState(onUpdate, triggerSource);
        }, debounceTime);
    }

    /**
     * Mutex-protected update method
     */
    private async updateAttachmentState(
        onUpdate: (ids: string[]) => void,
        triggerSource: string
    ): Promise<void> {
        if (this.updateInProgress) {
            debug(
                `🔒 [ATTACHMENT STATE] Update already in progress, skipping trigger from ${triggerSource}`
            );
            return;
        }

        this.updateInProgress = true;
        const updateStartTime = Date.now();

        try {
            debug(
                `🔄 [ATTACHMENT STATE] Starting attachment state update (triggered by: ${triggerSource})`
            );

            const newAttachmentIds = await this.getUnifiedPermanentAttachmentIds();
            const newAttachmentSet = new Set(newAttachmentIds);

            // Check if the list has actually changed
            const hasChanged =
                newAttachmentSet.size !== this.unifiedAttachmentIds.size ||
                !newAttachmentIds.every((id) => this.unifiedAttachmentIds.has(id));

            if (hasChanged) {
                debug(`🔄 [ATTACHMENT STATE] ✅ ATTACHMENT LIST CHANGED!`);
                debug(
                    `🔄 [ATTACHMENT STATE] Previous: ${this.unifiedAttachmentIds.size} attachments`
                );
                debug(
                    `🔄 [ATTACHMENT STATE] New: ${newAttachmentIds.length} attachments`
                );

                // Show what changed
                const previousIds = Array.from(this.unifiedAttachmentIds);
                const added = newAttachmentIds.filter(
                    (id) => !this.unifiedAttachmentIds.has(id)
                );
                const removed = previousIds.filter((id) => !newAttachmentSet.has(id));

                if (added.length > 0) {
                    debug(`🔄 [ATTACHMENT STATE] ➕ Added ${added.length} attachments'}`);
                }
                if (removed.length > 0) {
                    debug(
                        `🔄 [ATTACHMENT STATE] ➖ Removed ${removed.length} attachments: ${removed.slice(0, 5).join(', ')}${removed.length > 5 ? '...' : ''}`
                    );
                }

                // Update the unified state
                this.unifiedAttachmentIds = newAttachmentSet;
                this.lastUpdateTime = updateStartTime;

                debug(
                    `🔄 [ATTACHMENT STATE] 📤 Calling PowerSync onUpdate with ${newAttachmentIds.length} attachments...`
                );
                onUpdate(newAttachmentIds);
                debug(`🔄 [ATTACHMENT STATE] ✅ PowerSync onUpdate completed`);
            } else {
                debug(
                    `🔄 [ATTACHMENT STATE] ⏭️ No change in attachment list (${newAttachmentIds.length} attachments), skipping PowerSync update`
                );
            }

            const updateDuration = Date.now() - updateStartTime;
            debug(`🔄 [ATTACHMENT STATE] Update completed in ${updateDuration}ms`);
        } catch (error) {
            console.error(`🔄 [ATTACHMENT STATE] ❌ Error during update:`, error);
        } finally {
            this.updateInProgress = false;
        }
    }

    /**
     * Get current unified attachment IDs (synchronous)
     */
    getCurrentAttachmentIds(): string[] {
        return Array.from(this.unifiedAttachmentIds);
    }

    /**
     * Check if an update is currently in progress
     */
    isUpdateInProgress(): boolean {
        return this.updateInProgress;
    }

    /**
     * Get debug information about attachment sources
     */
    getDebugInfo() {
        return {
            totalAttachments: this.unifiedAttachmentIds.size,
            attachmentSources: Object.fromEntries(this.attachmentSources),
            lastUpdateTime: this.lastUpdateTime,
            updateInProgress: this.updateInProgress
        };
    }

    /**
     * Process any pending updates (called after download operations complete)
     */
    processPendingUpdates(onUpdate: (ids: string[]) => void): void {
        if (this.pendingUpdates.size > 0 && !this.downloadOperationInProgress) {
            debug(
                `🔄 [ATTACHMENT STATE] Processing ${this.pendingUpdates.size} pending updates: ${Array.from(this.pendingUpdates).join(', ')}`
            );

            // Process the highest priority update
            const priorityOrder = [
                'quest_downloads',
                'asset_downloads',
                'quest_asset_links',
                'asset_content',
                'translations'
            ];
            const pendingSources = Array.from(this.pendingUpdates);
            const sortedSources = pendingSources.sort((a, b) => {
                const aIndex = priorityOrder.indexOf(a);
                const bIndex = priorityOrder.indexOf(b);
                return (aIndex !== -1 ? aIndex : 999) - (bIndex !== -1 ? bIndex : 999);
            });

            // Clear pending updates and process the highest priority one
            this.pendingUpdates.clear();

            if (sortedSources.length > 0) {
                debug(
                    `🎯 [ATTACHMENT STATE] Processing deferred update: ${sortedSources[0]}`
                );
                this.updateWithDebounce(onUpdate, `deferred_${sortedSources[0]}`);
            }
        }
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (this.downloadOperationTimer) {
            clearTimeout(this.downloadOperationTimer);
            this.downloadOperationTimer = null;
        }
        this.updateInProgress = false;
        this.downloadOperationInProgress = false;
        this.unifiedAttachmentIds.clear();
        this.attachmentSources.clear();
        this.pendingUpdates.clear();
    }
}
