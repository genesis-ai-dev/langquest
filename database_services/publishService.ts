/**
 * Publishing Service - Safely publish Bible chapters from local to synced tables
 * 
 * CRITICAL: This service prioritizes data safety. We NEVER delete local records
 * until we're certain they've been successfully uploaded to the cloud.
 * 
 * Publishing Flow:
 * 1. Validate chapter data (all audio uploaded, no conflicts)
 * 2. Copy records from *_local → synced tables (triggers PowerSync upload)
 * 3. Mark as "publishing" and return immediately to user
 * 4. PowerSync uploads in background while connected
 * 5. Background process monitors upload status
 * 6. Only after successful cloud sync, delete local copies
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import type { AttachmentState } from '@powersync/attachments';
import { eq, inArray } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface PublishChapterParams {
    chapterId: string;
    userId: string;
}

export interface PublishChapterResult {
    success: boolean;
    status: 'queued' | 'uploading' | 'completed' | 'error';
    message: string;
    publishedQuestId?: string;
    publishedAssetIds?: string[];
    publishedProjectId?: string;
    publishedParentQuestId?: string;
    pendingAttachments?: number;
    errors?: string[];
}

interface ChapterData {
    project?: {
        id: string;
        name: string;
        description: string | null;
        target_language_id: string;
        creator_id: string | null;
        private: boolean;
        visible: boolean;
        download_profiles: string[] | null;
        template: 'unstructured' | 'bible' | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    };
    chapter: {
        id: string;
        name: string;
        description: string | null;
        project_id: string;
        parent_id: string | null;
        creator_id: string | null;
        visible: boolean;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    };
    parentBook?: {
        id: string;
        name: string;
        description: string | null;
        project_id: string;
        parent_id: string | null;
        creator_id: string | null;
        visible: boolean;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    };
    assets: Array<{
        id: string;
        name: string;
        order_index: number;
        source_language_id: string;
        project_id: string | null;
        parent_id: string | null;
        images: string[] | null;
        creator_id: string | null;
        visible: boolean;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }>;
    questAssetLinks: Array<{
        id: string;
        quest_id: string;
        asset_id: string;
        download_profiles: string[] | null;
        visible: boolean;
        created_at: string;
        last_updated: string;
        active: boolean;
    }>;
    assetContentLinks: Array<{
        id: string;
        asset_id: string;
        source_language_id: string | null;
        text: string;
        audio_id: string | null;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }>;
    tags: Array<{
        id: string;
        key: string;
        value: string;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }>;
    questTagLinks: Array<{
        id: string;
        quest_id: string;
        tag_id: string;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }>;
    assetTagLinks: Array<{
        id: string;
        asset_id: string;
        tag_id: string;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }>;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// ============================================================================
// STEP 1: GATHER ALL CHAPTER DATA
// ============================================================================

/**
 * Gather all data related to a chapter quest from local tables
 */
async function gatherChapterData(chapterId: string): Promise<ChapterData> {
    console.log(`📦 Gathering data for chapter: ${chapterId}`);

    const questLocal = resolveTable('quest', { localOverride: true });
    const projectLocal = resolveTable('project', { localOverride: true });
    const assetLocal = resolveTable('asset', { localOverride: true });
    const questAssetLinkLocal = resolveTable('quest_asset_link', { localOverride: true });
    const assetContentLinkLocal = resolveTable('asset_content_link', { localOverride: true });
    const tagLocal = resolveTable('tag', { localOverride: true });
    const questTagLinkLocal = resolveTable('quest_tag_link', { localOverride: true });
    const assetTagLinkLocal = resolveTable('asset_tag_link', { localOverride: true });

    // 1. Get chapter quest
    const [chapter] = await system.db
        .select()
        .from(questLocal)
        .where(eq(questLocal.id, chapterId))
        .limit(1);

    if (!chapter) {
        throw new Error(`Chapter quest not found: ${chapterId}`);
    }

    console.log(`📖 Found chapter: ${chapter.name}`);

    // 2. Get parent book quest if exists (and is local)
    let parentBook = undefined;
    if (chapter.parent_id) {
        const [parent] = await system.db
            .select()
            .from(questLocal)
            .where(eq(questLocal.id, chapter.parent_id))
            .limit(1);

        if (parent) {
            parentBook = parent;
            console.log(`📚 Found parent book: ${parent.name}`);
        } else {
            // Parent might already be published - that's okay
            console.log(`📚 Parent book already published or not in local: ${chapter.parent_id}`);
        }
    }

    // 3. Check if project needs to be published (unlikely but possible)
    let project = undefined;
    const [projectInLocal] = await system.db
        .select()
        .from(projectLocal)
        .where(eq(projectLocal.id, chapter.project_id))
        .limit(1);

    if (projectInLocal) {
        project = projectInLocal;
        console.log(`📁 Found project in local: ${project.name} - will publish with chapter`);
    }

    // 3. Get all assets in the chapter (with quest_asset_link)
    const questAssetLinks = await system.db
        .select()
        .from(questAssetLinkLocal)
        .where(eq(questAssetLinkLocal.quest_id, chapterId));

    console.log(`🎯 Found ${questAssetLinks.length} quest-asset links`);

    const assetIds = questAssetLinks.map(link => link.asset_id);

    let assets: ChapterData['assets'] = [];
    if (assetIds.length > 0) {
        assets = await system.db
            .select()
            .from(assetLocal)
            .where(inArray(assetLocal.id, assetIds))
            .orderBy(assetLocal.order_index, assetLocal.created_at);

        console.log(`📝 Found ${assets.length} assets`);
    }

    // 4. Get all asset content links
    let assetContentLinks: ChapterData['assetContentLinks'] = [];
    if (assetIds.length > 0) {
        assetContentLinks = await system.db
            .select()
            .from(assetContentLinkLocal)
            .where(inArray(assetContentLinkLocal.asset_id, assetIds))
            .orderBy(assetContentLinkLocal.created_at);

        console.log(`🔗 Found ${assetContentLinks.length} content links`);
    }

    // 5. Get quest tags
    const questTagLinks = await system.db
        .select()
        .from(questTagLinkLocal)
        .where(eq(questTagLinkLocal.quest_id, chapterId));

    // 6. Get asset tags
    let assetTagLinks: ChapterData['assetTagLinks'] = [];
    if (assetIds.length > 0) {
        assetTagLinks = await system.db
            .select()
            .from(assetTagLinkLocal)
            .where(inArray(assetTagLinkLocal.asset_id, assetIds));
    }

    // 7. Get all unique tags
    const tagIds = [
        ...questTagLinks.map(link => link.tag_id),
        ...assetTagLinks.map(link => link.tag_id)
    ];
    const uniqueTagIds = [...new Set(tagIds)];

    let tags: ChapterData['tags'] = [];
    if (uniqueTagIds.length > 0) {
        tags = await system.db
            .select()
            .from(tagLocal)
            .where(inArray(tagLocal.id, uniqueTagIds));

        console.log(`🏷️  Found ${tags.length} tags`);
    }

    return {
        project,
        chapter,
        parentBook,
        assets,
        questAssetLinks,
        assetContentLinks,
        tags,
        questTagLinks,
        assetTagLinks
    };
}

// ============================================================================
// STEP 2: VALIDATE DATA FOR PUBLISHING
// ============================================================================

/**
 * Validate that chapter data is ready for publishing
 * CRITICAL: This prevents data loss by ensuring everything is ready
 */
async function validateChapterForPublishing(
    data: ChapterData
): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('🔍 Validating chapter for publishing...');

    // 1. Check if chapter already exists in synced table
    const questSynced = resolveTable('quest', { localOverride: false });
    const [existingQuest] = await system.db
        .select()
        .from(questSynced)
        .where(eq(questSynced.id, data.chapter.id))
        .limit(1);

    if (existingQuest) {
        errors.push('Chapter has already been published');
    }

    // 2. Check if any assets already exist in synced table
    if (data.assets.length > 0) {
        const assetSynced = resolveTable('asset', { localOverride: false });
        const existingAssets = await system.db
            .select()
            .from(assetSynced)
            .where(inArray(assetSynced.id, data.assets.map(a => a.id)));

        if (existingAssets.length > 0) {
            errors.push(`${existingAssets.length} asset(s) already published`);
        }
    }

    // 3. Check all audio attachments are uploaded
    if (system.permAttachmentQueue) {
        const audioIds = data.assetContentLinks
            .map(link => link.audio_id)
            .filter((id): id is string => id !== null);

        if (audioIds.length > 0) {
            console.log(`🔊 Checking ${audioIds.length} audio files...`);

            for (const audioId of audioIds) {
                try {
                    const attachment = await system.powersync.getOptional<{
                        id: string;
                        state: AttachmentState;
                        local_uri: string | null;
                    }>(
                        `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
                        [audioId]
                    );

                    if (!attachment) {
                        errors.push(`Audio file not found: ${audioId.slice(0, 8)}`);
                        continue;
                    }

                    // Check if uploaded to cloud
                    // States: QUEUED_UPLOAD = 0, UPLOADING = 1, UPLOADED = 2, UPLOAD_ERROR = 3
                    if (attachment.state !== 2) { // Not UPLOADED
                        if (attachment.state === 0) { // QUEUED_UPLOAD
                            warnings.push(`Audio queued for upload: ${audioId.slice(0, 8)}`);
                        } else if (attachment.state === 1) { // UPLOADING
                            warnings.push(`Audio currently uploading: ${audioId.slice(0, 8)}`);
                        } else if (attachment.state === 3) { // UPLOAD_ERROR
                            errors.push(`Audio upload failed: ${audioId.slice(0, 8)}`);
                        }
                    }
                } catch (error) {
                    errors.push(`Failed to check audio: ${audioId.slice(0, 8)}`);
                    console.error('Attachment check error:', error);
                }
            }
        }
    }

    // 4. Verify project exists (will be published if in local, otherwise must exist in synced)
    if (!data.project) {
        // Not in local, check if it's in synced table
        const projectSynced = resolveTable('project', { localOverride: false });
        const [projectInSynced] = await system.db
            .select()
            .from(projectSynced)
            .where(eq(projectSynced.id, data.chapter.project_id))
            .limit(1);

        if (!projectInSynced) {
            errors.push('Project not found in local or synced tables - data may be corrupted');
        }
    } else {
        console.log(`✅ Project will be published: ${data.project.name}`);
    }

    // 5. Check assets have content
    if (data.assets.length === 0) {
        warnings.push('Chapter has no assets (verses)');
    }

    const valid = errors.length === 0;

    console.log(`✅ Validation complete: ${valid ? 'PASS' : 'FAIL'}`);
    if (errors.length > 0) {
        console.error('❌ Errors:', errors);
    }
    if (warnings.length > 0) {
        console.warn('⚠️  Warnings:', warnings);
    }

    return { valid, errors, warnings };
}

// ============================================================================
// STEP 3: TRIGGER AUDIO UPLOADS
// ============================================================================

/**
 * Ensure all audio files are queued for upload
 * Returns number of pending uploads
 */
async function ensureAudioUploaded(data: ChapterData): Promise<number> {
    if (!system.permAttachmentQueue) {
        console.warn('⚠️  Attachment queue not available');
        return 0;
    }

    const audioIds = data.assetContentLinks
        .map(link => link.audio_id)
        .filter((id): id is string => id !== null);

    if (audioIds.length === 0) {
        return 0;
    }

    let pendingCount = 0;

    for (const audioId of audioIds) {
        try {
            const attachment = await system.powersync.getOptional<{
                id: string;
                state: AttachmentState;
            }>(
                `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
                [audioId]
            );

            if (attachment && attachment.state !== 2) { // Not UPLOADED
                pendingCount++;
            }
        } catch (error) {
            console.error(`Failed to check attachment ${audioId}:`, error);
            pendingCount++;
        }
    }

    // Trigger upload queue if there are pending files
    if (pendingCount > 0) {
        console.log(`🚀 Triggering upload for ${pendingCount} pending audio files...`);
        system.permAttachmentQueue.trigger();
    }

    return pendingCount;
}

// ============================================================================
// STEP 4: ATOMIC PUBLISH TRANSACTION
// ============================================================================

/**
 * Copy all records from *_local to synced tables
 * CRITICAL: This triggers PowerSync upload, but we keep local copies as backup
 */
async function executePublishTransaction(
    data: ChapterData,
    userId: string
): Promise<void> {
    console.log('🔒 Starting publish transaction...');

    await system.db.transaction(async (tx) => {
        const project = resolveTable('project', { localOverride: false });
        const quest = resolveTable('quest', { localOverride: false });
        const asset = resolveTable('asset', { localOverride: false });
        const questAssetLink = resolveTable('quest_asset_link', { localOverride: false });
        const assetContentLink = resolveTable('asset_content_link', { localOverride: false });
        const tag = resolveTable('tag', { localOverride: false });
        const questTagLink = resolveTable('quest_tag_link', { localOverride: false });
        const assetTagLink = resolveTable('asset_tag_link', { localOverride: false });

        // 1. Publish project if exists in local (rare but possible)
        if (data.project) {
            console.log(`📁 Publishing project: ${data.project.name}`);
            await tx.insert(project).values({
                id: data.project.id,
                name: data.project.name,
                description: data.project.description,
                target_language_id: data.project.target_language_id,
                creator_id: data.project.creator_id,
                private: data.project.private,
                visible: data.project.visible,
                download_profiles: data.project.download_profiles,
                template: data.project.template,
                created_at: data.project.created_at,
                last_updated: data.project.last_updated,
                active: data.project.active
            });
        }

        // 2. Publish parent book if exists and is local
        if (data.parentBook) {
            console.log(`📚 Publishing parent book: ${data.parentBook.name}`);
            await tx.insert(quest).values({
                id: data.parentBook.id,
                name: data.parentBook.name,
                description: data.parentBook.description,
                project_id: data.parentBook.project_id,
                parent_id: data.parentBook.parent_id,
                creator_id: data.parentBook.creator_id,
                visible: data.parentBook.visible,
                download_profiles: data.parentBook.download_profiles,
                created_at: data.parentBook.created_at,
                last_updated: data.parentBook.last_updated,
                active: data.parentBook.active
            });
        }

        // 3. Publish chapter quest
        console.log(`📖 Publishing chapter: ${data.chapter.name}`);
        await tx.insert(quest).values({
            id: data.chapter.id,
            name: data.chapter.name,
            description: data.chapter.description,
            project_id: data.chapter.project_id,
            parent_id: data.chapter.parent_id,
            creator_id: data.chapter.creator_id,
            visible: data.chapter.visible,
            download_profiles: data.chapter.download_profiles,
            created_at: data.chapter.created_at,
            last_updated: data.chapter.last_updated,
            active: data.chapter.active
        });

        // 4. Publish tags (if any)
        if (data.tags.length > 0) {
            console.log(`🏷️  Publishing ${data.tags.length} tags...`);
            for (const tagData of data.tags) {
                // Check if tag already exists (might be shared)
                const [existing] = await tx
                    .select()
                    .from(tag)
                    .where(eq(tag.id, tagData.id))
                    .limit(1);

                if (!existing) {
                    await tx.insert(tag).values({
                        id: tagData.id,
                        key: tagData.key,
                        value: tagData.value,
                        download_profiles: tagData.download_profiles,
                        created_at: tagData.created_at,
                        last_updated: tagData.last_updated,
                        active: tagData.active
                    });
                }
            }
        }

        // 5. Publish assets (preserving order)
        if (data.assets.length > 0) {
            console.log(`📝 Publishing ${data.assets.length} assets...`);
            for (const assetData of data.assets) {
                await tx.insert(asset).values({
                    id: assetData.id,
                    name: assetData.name,
                    order_index: assetData.order_index,
                    source_language_id: assetData.source_language_id,
                    project_id: assetData.project_id,
                    parent_id: assetData.parent_id,
                    images: assetData.images,
                    creator_id: assetData.creator_id,
                    visible: assetData.visible,
                    download_profiles: assetData.download_profiles,
                    created_at: assetData.created_at,
                    last_updated: assetData.last_updated,
                    active: assetData.active
                });
            }
        }

        // 6. Publish quest-asset links
        if (data.questAssetLinks.length > 0) {
            console.log(`🔗 Publishing ${data.questAssetLinks.length} quest-asset links...`);
            for (const link of data.questAssetLinks) {
                await tx.insert(questAssetLink).values({
                    id: link.id,
                    quest_id: link.quest_id,
                    asset_id: link.asset_id,
                    download_profiles: link.download_profiles,
                    visible: link.visible,
                    created_at: link.created_at,
                    last_updated: link.last_updated,
                    active: link.active
                });
            }
        }

        // 7. Publish asset content links
        if (data.assetContentLinks.length > 0) {
            console.log(`🔗 Publishing ${data.assetContentLinks.length} content links...`);
            for (const link of data.assetContentLinks) {
                await tx.insert(assetContentLink).values({
                    id: link.id,
                    asset_id: link.asset_id,
                    source_language_id: link.source_language_id,
                    text: link.text,
                    audio_id: link.audio_id,
                    download_profiles: link.download_profiles,
                    created_at: link.created_at,
                    last_updated: link.last_updated,
                    active: link.active
                });
            }
        }

        // 8. Publish tag links
        if (data.questTagLinks.length > 0) {
            console.log(`🔗 Publishing ${data.questTagLinks.length} quest-tag links...`);
            for (const link of data.questTagLinks) {
                await tx.insert(questTagLink).values({
                    id: link.id,
                    quest_id: link.quest_id,
                    tag_id: link.tag_id,
                    download_profiles: link.download_profiles,
                    created_at: link.created_at,
                    last_updated: link.last_updated,
                    active: link.active
                });
            }
        }

        if (data.assetTagLinks.length > 0) {
            console.log(`🔗 Publishing ${data.assetTagLinks.length} asset-tag links...`);
            for (const link of data.assetTagLinks) {
                await tx.insert(assetTagLink).values({
                    id: link.id,
                    asset_id: link.asset_id,
                    tag_id: link.tag_id,
                    download_profiles: link.download_profiles,
                    created_at: link.created_at,
                    last_updated: link.last_updated,
                    active: link.active
                });
            }
        }

        console.log('✅ All records copied to synced tables');
    });

    console.log('🚀 Transaction complete - PowerSync will now upload to cloud');
}

// ============================================================================
// MAIN PUBLISH FUNCTION
// ============================================================================

/**
 * Publish a Bible chapter to the cloud
 * 
 * SAFETY GUARANTEE: Local records are preserved until cloud sync is confirmed.
 * This function returns immediately after queueing the publish operation.
 * PowerSync handles the actual upload in the background.
 * 
 * @param params - Chapter ID and user ID
 * @returns Result indicating publish was queued successfully
 */
export async function publishBibleChapter(
    params: PublishChapterParams
): Promise<PublishChapterResult> {
    const { chapterId, userId } = params;

    console.log(`\n📤 PUBLISHING CHAPTER: ${chapterId}`);
    console.log(`👤 User: ${userId}`);

    try {
        // STEP 1: Gather all data
        const chapterData = await gatherChapterData(chapterId);

        // STEP 2: Validate data
        const validation = await validateChapterForPublishing(chapterData);

        if (!validation.valid) {
            return {
                success: false,
                status: 'error',
                message: 'Validation failed',
                errors: validation.errors
            };
        }

        // STEP 3: Ensure audio files are uploading
        const pendingAttachments = await ensureAudioUploaded(chapterData);

        if (pendingAttachments > 0) {
            console.log(`⏳ ${pendingAttachments} audio files still uploading...`);
        }

        // STEP 4: Execute publish transaction
        // This copies records to synced tables, triggering PowerSync upload
        await executePublishTransaction(chapterData, userId);

        console.log('\n✅ CHAPTER QUEUED FOR PUBLISHING');
        console.log('📡 PowerSync is uploading to cloud in background...');
        console.log('💾 Local copies preserved until cloud sync confirmed');

        // Build success message with details about what was published
        let successMessage = '';
        const publishedItems: string[] = [];

        if (chapterData.project) {
            publishedItems.push(`Project: ${chapterData.project.name}`);
        }
        if (chapterData.parentBook) {
            publishedItems.push(`Book: ${chapterData.parentBook.name}`);
        }
        publishedItems.push(`Chapter: ${chapterData.chapter.name}`);
        publishedItems.push(`${chapterData.assets.length} verses`);

        if (publishedItems.length > 2) {
            successMessage = `Published:\n• ${publishedItems.join('\n• ')}`;
        } else {
            successMessage = 'Chapter queued for publishing!';
        }

        if (pendingAttachments > 0) {
            successMessage += `\n\n${pendingAttachments} audio files are uploading in the background.`;
        }

        return {
            success: true,
            status: pendingAttachments > 0 ? 'uploading' : 'queued',
            message: successMessage,
            publishedQuestId: chapterId,
            publishedAssetIds: chapterData.assets.map(a => a.id),
            publishedProjectId: chapterData.project?.id,
            publishedParentQuestId: chapterData.parentBook?.id,
            pendingAttachments
        };
    } catch (error) {
        console.error('❌ PUBLISH FAILED:', error);

        return {
            success: false,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            errors: [error instanceof Error ? error.message : String(error)]
        };
    }
}

// ============================================================================
// CLEANUP FUNCTIONS (For future background process)
// ============================================================================

/**
 * Clean up local records after successful cloud sync
 * TODO: This should be called by a background process that monitors PowerSync sync status
 * 
 * For now, we keep local records as a safety measure.
 * Future: Implement a background job that:
 * 1. Checks PowerSync upload queue is empty
 * 2. Verifies records exist in cloud
 * 3. Only then deletes local copies
 */
export async function cleanupLocalRecordsAfterSync(
    chapterId: string
): Promise<void> {
    console.log(`🧹 Cleaning up local records for chapter: ${chapterId}`);

    // TODO: Implement safe cleanup logic
    // For now, we intentionally keep local records as backup

    console.log('⚠️  Cleanup not yet implemented - local records preserved for safety');
}

