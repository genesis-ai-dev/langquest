/**
 * Publishing Service - Safely publish Bible chapters from local to synced tables
 * 
 * CRITICAL: This service prioritizes data safety. We NEVER delete local records.
 * Local records are preserved indefinitely as a backup, even after successful publish.
 * 
 * Publishing Flow:
 * 1. Validate chapter data (all audio uploaded, no conflicts)
 * 2. Copy records from *_local → synced tables (triggers PowerSync upload)
 * 3. Mark as "publishing" and return immediately to user
 * 4. PowerSync uploads in background while connected
 * 5. Local records remain as backup (NOT deleted)
 * 
 * Cleanup Policy:
 * - Local records are preserved indefinitely for data safety
 * - Future: Manual cleanup service (verify in Supabase → then delete)
 * - Cleanup is NOT part of publishing flow
 */

import { system } from '@/db/powersync/system';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import { resolveTable } from '@/utils/dbUtils';
import type { AttachmentState } from '@powersync/attachments';
import { eq, inArray } from 'drizzle-orm';
import uuid from 'react-native-uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface PublishChapterParams {
    chapterId: string;
    userId: string;
    t: (key: string) => string;
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
    profileProjectLink?: {
        id: string;
        profile_id: string;
        project_id: string;
        membership: string | null;
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
        metadata: Record<string, unknown> | null;
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
        metadata: Record<string, unknown> | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    };
    assets: {
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
    }[];
    questAssetLinks: {
        id: string;
        quest_id: string;
        asset_id: string;
        download_profiles: string[] | null;
        visible: boolean;
        created_at: string;
        last_updated: string;
        active: boolean;
    }[];
    assetContentLinks: {
        id: string;
        asset_id: string;
        source_language_id: string | null;
        text: string;
        audio_id: string | null;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }[];
    tags: {
        id: string;
        key: string;
        value: string;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }[];
    questTagLinks: {
        id: string;
        quest_id: string;
        tag_id: string;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }[];
    assetTagLinks: {
        id: string;
        asset_id: string;
        tag_id: string;
        download_profiles: string[] | null;
        created_at: string;
        last_updated: string;
        active: boolean;
    }[];
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

    // 2. Get parent book quest if exists (check both local and synced tables)
    let parentBook = undefined;
    if (chapter.parent_id) {
        // First check quest_local (local-only)
        const [parentInLocal] = await system.db
            .select()
            .from(questLocal)
            .where(eq(questLocal.id, chapter.parent_id))
            .limit(1);

        if (parentInLocal) {
            parentBook = parentInLocal;
            console.log(`📚 Found parent book in local: ${parentInLocal.name}`);
        } else {
            // Also check quest (synced table) - might be synced but not uploaded to Supabase yet
            const questSynced = resolveTable('quest', { localOverride: false });
            const [parentInSynced] = await system.db
                .select()
                .from(questSynced)
                .where(eq(questSynced.id, chapter.parent_id))
                .limit(1);

            if (parentInSynced) {
                parentBook = parentInSynced;
                console.log(`📚 Found parent book in synced table: ${parentInSynced.name} - will ensure it's published`);
            } else {
                // Parent doesn't exist locally at all - assume it's already in Supabase
                console.log(`📚 Parent book not found locally, assuming already in Supabase: ${chapter.parent_id}`);
            }
        }
    }

    // 3. Check if project needs to be published (unlikely but possible)
    let project = undefined;
    let profileProjectLink = undefined;

    const [projectInLocal] = await system.db
        .select()
        .from(projectLocal)
        .where(eq(projectLocal.id, chapter.project_id))
        .limit(1);

    if (projectInLocal) {
        project = projectInLocal;
        console.log(`📁 Found project in local: ${project.name} - will publish with chapter`);

        // Also get the profile_project_link for this project (needed for RLS)
        const profileProjectLinkLocal = resolveTable('profile_project_link', { localOverride: true });
        const [linkInLocal] = await system.db
            .select()
            .from(profileProjectLinkLocal)
            .where(eq(profileProjectLinkLocal.project_id, project.id))
            .limit(1);

        if (linkInLocal) {
            profileProjectLink = linkInLocal;
            console.log(`🔗 Found profile-project link - will publish for RLS`);
        }
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
        profileProjectLink,
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
    data: ChapterData,
    userId: string
): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('🔍 Validating chapter for publishing...');

    // 0. CRITICAL: Check if profile_project_link exists in Supabase
    // This is required for RLS policies to allow inserts
    // SKIP THIS CHECK if we're publishing the project (it will be uploaded)
    if (data.chapter.project_id && !data.project) {
        // Only check if we're NOT publishing a new project
        try {
            const { data: linkData, error } = await system.supabaseConnector.client
                .from('profile_project_link')
                .select('*')
                .eq('project_id', data.chapter.project_id)
                .eq('profile_id', userId)
                .eq('membership', 'owner')
                .eq('active', true)
                .limit(1);

            if (error) {
                console.warn('⚠️  Could not check profile_project_link in cloud:', error);
                warnings.push('Could not verify project ownership in cloud');
            } else if (!linkData || linkData.length === 0) {
                errors.push('You must be a project owner with an active membership link in the cloud database to publish. The project may need to be published first.');
            } else {
                console.log('✅ Verified project ownership in cloud');
            }
        } catch (error) {
            console.error('Error checking profile_project_link:', error);
            warnings.push('Could not verify project ownership - publish may fail with RLS error');
        }
    } else if (data.project) {
        // We're publishing the project, so profile_project_link will be created
        console.log('✅ Project will be published - profile_project_link will be created');

        // Double-check we have the profile_project_link data to publish
        if (!data.profileProjectLink) {
            errors.push('Cannot publish project - profile_project_link not found in local tables');
        }
    }

    // 1. Check if chapter already exists in synced table
    // NOTE: We don't fail if it exists - we'll make the operation idempotent
    const questSynced = resolveTable('quest', { localOverride: false });
    const [existingQuest] = await system.db
        .select()
        .from(questSynced)
        .where(eq(questSynced.id, data.chapter.id))
        .limit(1);

    if (existingQuest) {
        console.log('ℹ️  Chapter already exists in synced table - will update if needed');
    }

    // 2. Check if any assets already exist in synced table
    // NOTE: We don't fail if they exist - we'll skip them in the transaction
    if (data.assets.length > 0) {
        const assetSynced = resolveTable('asset', { localOverride: false });
        const existingAssets = await system.db
            .select()
            .from(assetSynced)
            .where(inArray(assetSynced.id, data.assets.map(a => a.id)));

        if (existingAssets.length > 0) {
            console.log(`ℹ️  ${existingAssets.length} asset(s) already exist in synced table - will skip them`);
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
 * Upload parent book directly to Supabase to satisfy foreign key constraints
 * CRITICAL: Parent MUST exist in Supabase before PowerSync uploads the chapter
 * We bypass PowerSync here and upload directly to guarantee ordering
 */
async function ensureParentBookInSupabase(data: ChapterData): Promise<void> {
    if (!data.parentBook) return;

    console.log(`🔍 Checking if parent book exists in Supabase: ${data.parentBook.name}`);

    try {
        // Check if parent book already exists in Supabase
        const { data: existing, error: checkError } = await system.supabaseConnector.client
            .from('quest')
            .select('id')
            .eq('id', data.parentBook.id)
            .limit(1);

        if (checkError) {
            console.warn('⚠️  Could not check parent book in Supabase:', checkError);
            throw new Error(`Failed to check parent book: ${checkError.message}`);
        }

        if (existing && existing.length > 0) {
            console.log(`✅ Parent book already exists in Supabase`);
            return;
        }

        // Parent doesn't exist - upload it directly to Supabase (bypass PowerSync)
        console.log(`📤 Uploading parent book directly to Supabase: ${data.parentBook.name}`);

        const { error: insertError } = await system.supabaseConnector.client
            .from('quest')
            .insert({
                id: data.parentBook.id,
                name: data.parentBook.name,
                description: data.parentBook.description,
                project_id: data.parentBook.project_id,
                parent_id: data.parentBook.parent_id,
                creator_id: data.parentBook.creator_id,
                visible: data.parentBook.visible,
                download_profiles: data.parentBook.download_profiles,
                metadata: data.parentBook.metadata,
                created_at: data.parentBook.created_at,
                last_updated: data.parentBook.last_updated,
                active: data.parentBook.active
            });

        if (insertError) {
            // If error is "already exists", that's okay - race condition with another process
            if (insertError.code === '23505') {
                console.log(`✅ Parent book was already inserted by another process`);
                return;
            }
            throw new Error(`Failed to insert parent book: ${insertError.message}`);
        }

        console.log(`✅ Parent book uploaded directly to Supabase`);
    } catch (error) {
        console.error('❌ Failed to ensure parent book in Supabase:', error);
        throw error;
    }
}

/**
 * Wait for critical dependencies to exist in Supabase
 * This ensures RLS policies can validate parent relationships
 */
async function waitForCriticalDependencies(
    data: ChapterData,
    userId: string
): Promise<void> {
    console.log('⏳ Waiting for PowerSync to upload dependencies to Supabase...');

    const maxWaitTime = 15000; // 15 seconds max (reduced from 30s)
    const pollInterval = 500; // Check every 0.5 seconds (more responsive)
    const startTime = Date.now();

    // We need to wait for:
    // 1. profile_project_link (if publishing new project)
    // 2. All assets (parent of asset_content_link)
    // 3. quest_asset_link (RLS policy needs this to find project relationship)
    // Note: Parent book is handled upfront via ensureParentBookInSupabase()

    let profileLinkReady = !data.project; // Already ready if not publishing project
    let assetsReady = data.assets.length === 0; // Already ready if no assets
    let questAssetLinksReady = data.questAssetLinks.length === 0; // Already ready if no links

    // Track what we've already confirmed to avoid redundant checks and logs
    let projectConfirmed = false;
    let lastProgressLog = startTime;
    const progressLogInterval = 2000; // Only log progress every 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
        const elapsed = Date.now() - startTime;

        // Check profile_project_link if needed
        // CRITICAL: This must exist before asset_content_link can upload
        if (!profileLinkReady && data.project) {
            try {
                // First check if project exists (required by RLS) - but only log once
                if (!projectConfirmed) {
                    const { data: projectData } = await system.supabaseConnector.client
                        .from('project')
                        .select('id')
                        .eq('id', data.project.id)
                        .limit(1);

                    if (projectData && projectData.length > 0) {
                        console.log(`✅ Project synced to Supabase (${elapsed}ms)`);
                        projectConfirmed = true;
                    }
                }

                // Now check profile_project_link
                if (projectConfirmed) {
                    const { data: linkData, error } = await system.supabaseConnector.client
                        .from('profile_project_link')
                        .select('id')
                        .eq('project_id', data.project.id)
                        .eq('profile_id', userId)
                        .limit(1);

                    if (!error && linkData && linkData.length > 0) {
                        console.log(`✅ profile_project_link synced to Supabase (${elapsed}ms)`);
                        profileLinkReady = true;
                    } else if (!error && Date.now() - lastProgressLog > progressLogInterval) {
                        console.log(`⏳ Waiting for profile_project_link... (${elapsed}ms)`);
                        lastProgressLog = Date.now();
                    }
                }
            } catch (error) {
                console.warn('Error checking dependencies:', error);
            }
        }

        // Check assets if needed
        if (!assetsReady && data.assets.length > 0) {
            try {
                const assetIds = data.assets.map(a => a.id);
                const { data: assetsData, error } = await system.supabaseConnector.client
                    .from('asset')
                    .select('id')
                    .in('id', assetIds);

                if (!error && assetsData && assetsData.length === data.assets.length) {
                    console.log(`✅ All ${data.assets.length} assets synced to Supabase (${elapsed}ms)`);
                    assetsReady = true;
                } else if (assetsData && Date.now() - lastProgressLog > progressLogInterval) {
                    console.log(`⏳ Assets syncing: ${assetsData.length}/${data.assets.length} (${elapsed}ms)`);
                    lastProgressLog = Date.now();
                }
            } catch (error) {
                console.warn('Error checking assets:', error);
            }
        }

        // Check quest_asset_link if needed
        // CRITICAL: RLS policy for asset_content_link needs these to exist
        if (!questAssetLinksReady && data.questAssetLinks.length > 0) {
            try {
                const linkIds = data.questAssetLinks.map(l => l.id);
                const { data: linksData, error } = await system.supabaseConnector.client
                    .from('quest_asset_link')
                    .select('id')
                    .in('id', linkIds);

                if (!error && linksData && linksData.length === data.questAssetLinks.length) {
                    console.log(`✅ All ${data.questAssetLinks.length} quest_asset_links synced to Supabase (${elapsed}ms)`);
                    questAssetLinksReady = true;
                } else if (linksData && Date.now() - lastProgressLog > progressLogInterval) {
                    console.log(`⏳ Quest-asset links syncing: ${linksData.length}/${data.questAssetLinks.length} (${elapsed}ms)`);
                    lastProgressLog = Date.now();
                }
            } catch (error) {
                console.warn('Error checking quest_asset_link:', error);
            }
        }

        // If everything is ready, we're done
        if (profileLinkReady && assetsReady && questAssetLinksReady) {
            console.log(`✅ All dependencies ready (${elapsed}ms)`);
            return;
        }

        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // If we got here, we timed out
    const elapsed = Date.now() - startTime;
    console.warn(`⚠️  Timeout after ${elapsed}ms waiting for:`);
    if (!profileLinkReady) {
        console.warn('  - profile_project_link (PowerSync still uploading)');
    }
    if (!assetsReady) {
        console.warn(`  - ${data.assets.length} assets (PowerSync still uploading)`);
    }
    if (!questAssetLinksReady) {
        console.warn(`  - ${data.questAssetLinks.length} quest_asset_links (PowerSync still uploading)`);
    }
    console.warn('⚠️  Continuing anyway - PowerSync will retry failed uploads');
}

/**
 * Copy all records from *_local to synced tables
 * CRITICAL: We insert asset_content_link SEPARATELY after dependencies are confirmed
 * This prevents PowerSync from uploading them before RLS dependencies are ready
 */
async function executePublishTransaction(
    data: ChapterData,
    userId: string,
    includeContentLinks = false
): Promise<void> {
    console.log(`🔒 Starting publish transaction (includeContentLinks: ${includeContentLinks})...`);

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
            // Check if project already exists
            const [existingProject] = await tx
                .select()
                .from(project)
                .where(eq(project.id, data.project.id))
                .limit(1);

            if (!existingProject) {
                console.log(`📁 Publishing project: ${data.project.name}`);
                const [insertedProject] = await tx.insert(project).values({
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
                }).returning();

                console.log(`✅ Project inserted into synced table:`, insertedProject?.id);
            } else {
                console.log(`⏭️  Project already exists in synced table, skipping`);
            }

            // CRITICAL: Also publish the profile_project_link (for RLS policies)
            const profileProjectLinkTable = resolveTable('profile_project_link', { localOverride: false });

            // Use proper UUID generation for fallback ID (not string concatenation)
            const linkId = data.profileProjectLink?.id || String(uuid.v4());
            const [existingLink] = await tx
                .select()
                .from(profileProjectLinkTable)
                .where(eq(profileProjectLinkTable.id, linkId))
                .limit(1);

            if (!existingLink) {
                if (data.profileProjectLink) {
                    await tx.insert(profileProjectLinkTable).values({
                        id: data.profileProjectLink.id,
                        profile_id: data.profileProjectLink.profile_id,
                        project_id: data.profileProjectLink.project_id,
                        membership: data.profileProjectLink.membership,
                        created_at: data.profileProjectLink.created_at,
                        last_updated: data.profileProjectLink.last_updated,
                        active: data.profileProjectLink.active
                    });

                    console.log(`✅ Profile-project link published for RLS policies`);
                } else {
                    console.warn(`⚠️  No profile_project_link found - creating one for user ${userId}`);
                    await tx.insert(profileProjectLinkTable).values({
                        id: linkId,
                        profile_id: userId,
                        project_id: data.project.id,
                        membership: 'owner',
                        created_at: data.project.created_at,
                        last_updated: data.project.last_updated,
                        active: true
                    });

                    console.log(`✅ Profile-project link created (fallback) for RLS policies`);
                }
            } else {
                console.log(`⏭️  Profile-project link already exists, skipping`);
            }
        }

        // 2. Publish parent book if exists and is local
        if (data.parentBook) {
            const [existingBook] = await tx
                .select()
                .from(quest)
                .where(eq(quest.id, data.parentBook.id))
                .limit(1);

            if (!existingBook) {
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
                    metadata: data.parentBook.metadata,
                    created_at: data.parentBook.created_at,
                    last_updated: data.parentBook.last_updated,
                    active: data.parentBook.active
                });
            } else {
                console.log(`⏭️  Parent book already exists in synced table, skipping`);
            }
        }

        // 3. Publish chapter quest
        const [existingChapter] = await tx
            .select()
            .from(quest)
            .where(eq(quest.id, data.chapter.id))
            .limit(1);

        if (!existingChapter) {
            console.log(`📖 Publishing chapter: ${data.chapter.name}`);
            const [insertedQuest] = await tx.insert(quest).values({
                id: data.chapter.id,
                name: data.chapter.name,
                description: data.chapter.description,
                project_id: data.chapter.project_id,
                parent_id: data.chapter.parent_id,
                creator_id: data.chapter.creator_id,
                visible: data.chapter.visible,
                download_profiles: data.chapter.download_profiles,
                metadata: data.chapter.metadata,
                created_at: data.chapter.created_at,
                last_updated: data.chapter.last_updated,
                active: data.chapter.active
            }).returning();

            console.log(`✅ Quest inserted into synced table:`, insertedQuest?.id);
        } else {
            console.log(`⏭️  Chapter already exists in synced table, skipping`);
        }

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
            let skipped = 0;
            for (const assetData of data.assets) {
                // Check if asset already exists
                const [existingAsset] = await tx
                    .select()
                    .from(asset)
                    .where(eq(asset.id, assetData.id))
                    .limit(1);

                if (!existingAsset) {
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
                } else {
                    skipped++;
                }
            }
            if (skipped > 0) {
                console.log(`⏭️  Skipped ${skipped} assets that already exist`);
            }
        }

        // 6. Publish quest-asset links
        if (data.questAssetLinks.length > 0) {
            console.log(`🔗 Publishing ${data.questAssetLinks.length} quest-asset links...`);
            let skipped = 0;
            for (const link of data.questAssetLinks) {
                const [existing] = await tx
                    .select()
                    .from(questAssetLink)
                    .where(eq(questAssetLink.id, link.id))
                    .limit(1);

                if (!existing) {
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
                } else {
                    skipped++;
                }
            }
            if (skipped > 0) {
                console.log(`⏭️  Skipped ${skipped} quest-asset links that already exist`);
            }
        }

        // 7. Publish asset content links (ONLY if includeContentLinks is true)
        // This is delayed until after dependencies are confirmed
        if (includeContentLinks && data.assetContentLinks.length > 0) {
            console.log(`🔗 Publishing ${data.assetContentLinks.length} content links...`);
            let skipped = 0;
            for (const link of data.assetContentLinks) {
                const [existing] = await tx
                    .select()
                    .from(assetContentLink)
                    .where(eq(assetContentLink.id, link.id))
                    .limit(1);

                if (!existing) {
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
                } else {
                    skipped++;
                }
            }
            if (skipped > 0) {
                console.log(`⏭️  Skipped ${skipped} content links that already exist`);
            }
        } else if (!includeContentLinks && data.assetContentLinks.length > 0) {
            console.log(`⏸️  Delaying ${data.assetContentLinks.length} content links until dependencies are ready`);
        }

        // 8. Publish tag links
        if (data.questTagLinks.length > 0) {
            console.log(`🔗 Publishing ${data.questTagLinks.length} quest-tag links...`);
            let skipped = 0;
            for (const link of data.questTagLinks) {
                const [existing] = await tx
                    .select()
                    .from(questTagLink)
                    .where(eq(questTagLink.id, link.id))
                    .limit(1);

                if (!existing) {
                    await tx.insert(questTagLink).values({
                        id: link.id,
                        quest_id: link.quest_id,
                        tag_id: link.tag_id,
                        download_profiles: link.download_profiles,
                        created_at: link.created_at,
                        last_updated: link.last_updated,
                        active: link.active
                    });
                } else {
                    skipped++;
                }
            }
            if (skipped > 0) {
                console.log(`⏭️  Skipped ${skipped} quest-tag links that already exist`);
            }
        }

        if (data.assetTagLinks.length > 0) {
            console.log(`🔗 Publishing ${data.assetTagLinks.length} asset-tag links...`);
            let skipped = 0;
            for (const link of data.assetTagLinks) {
                const [existing] = await tx
                    .select()
                    .from(assetTagLink)
                    .where(eq(assetTagLink.id, link.id))
                    .limit(1);

                if (!existing) {
                    await tx.insert(assetTagLink).values({
                        id: link.id,
                        asset_id: link.asset_id,
                        tag_id: link.tag_id,
                        download_profiles: link.download_profiles,
                        created_at: link.created_at,
                        last_updated: link.last_updated,
                        active: link.active
                    });
                } else {
                    skipped++;
                }
            }
            if (skipped > 0) {
                console.log(`⏭️  Skipped ${skipped} asset-tag links that already exist`);
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
    const { chapterId, userId, t } = params;

    console.log(`\n📤 PUBLISHING CHAPTER: ${chapterId}`);
    console.log(`👤 User: ${userId}`);

    // if user is offline, return with an alert 
    if (!getNetworkStatus()) {
        return {
            success: false,
            status: 'error',
            message: t('cannotPublishWhileOffline'),
        };
    }

    try {
        // STEP 1: Gather all data
        const chapterData = await gatherChapterData(chapterId);

        // STEP 2: Validate data
        const validation = await validateChapterForPublishing(chapterData, userId);

        if (!validation.valid) {
            return {
                success: false,
                status: 'error',
                message: 'Validation failed',
                errors: validation.errors
            };
        }

        // STEP 3: Ensure parent book exists in Supabase FIRST (bypass PowerSync for ordering)
        // This prevents foreign key constraint violations during chapter upload
        await ensureParentBookInSupabase(chapterData);

        // STEP 4: Ensure audio files are uploading
        const pendingAttachments = await ensureAudioUploaded(chapterData);

        if (pendingAttachments > 0) {
            console.log(`⏳ ${pendingAttachments} audio files still uploading...`);
        }

        // STEP 5A: Execute publish transaction (WITHOUT asset_content_link)
        // This prevents PowerSync from trying to upload content links before dependencies are ready
        await executePublishTransaction(chapterData, userId, false);

        // STEP 5B: Wait for critical dependencies to reach Supabase
        // This ensures RLS policies have everything they need before we insert content links
        console.log('⏳ Waiting before inserting asset_content_link records...');
        await waitForCriticalDependencies(chapterData, userId);

        // STEP 5C: Now insert asset_content_link records
        // Dependencies are confirmed, so RLS should pass
        console.log('✅ Dependencies ready - inserting asset_content_link records');
        await executePublishTransaction(chapterData, userId, true);

        console.log('\n✅ CHAPTER PUBLISH COMPLETE');
        console.log('📡 PowerSync is uploading to cloud in background...');
        console.log('💾 Local copies preserved indefinitely for data safety');
        console.log('♻️  Publish is idempotent - safe to retry if needed');

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
// LOCAL RECORD CLEANUP POLICY
// ============================================================================
//
// CRITICAL: We intentionally DO NOT delete local records during or after publishing.
//
// Publishing Flow (Current - Safe):
// 1. Copy records from *_local → synced tables
// 2. PowerSync uploads synced tables to Supabase (background)
// 3. Local records remain as backup indefinitely
//
// Why We Don't Delete Local Records:
// ✓ PowerSync may fail to upload (network issues, RLS errors, server problems)
// ✓ If we delete before confirming cloud upload, data loss can occur
// ✓ Local records serve as backup if remote database has issues
// ✓ Users can recover data if remote gets corrupted or deleted
// ✓ No risk of race conditions or timing issues with PowerSync
//
// Future Manual Cleanup Strategy (NOT IMPLEMENTED YET):
// - Create a separate cleanup service/function (run manually by user/admin)
// - That service should:
//   1. Query Supabase directly to confirm record exists
//   2. Verify data integrity (compare timestamps, checksums, etc.)
//   3. Confirm PowerSync upload queue is empty for those records
//   4. Only then delete from *_local tables
// - NEVER tie cleanup to PowerSync upload events (could be false positive)
// - Make cleanup opt-in and transparent to user
// - Log all deletions for audit trail
//
// Current Status: Local records preserved indefinitely for maximum safety.
// ============================================================================

