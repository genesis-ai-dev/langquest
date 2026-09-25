import { system } from '@/db/powersync/system';
import type { VerifiedIds } from '@/hooks/useQuestOffloadVerification';
import { bulkUndownloadQuest } from '@/utils/bulkUndownload';

interface OffloadQuestParams {
  questId: string;
  verifiedIds: VerifiedIds;
  onProgress?: (progress: number, message: string) => void;
  /** How long to wait for PowerSync to drop the local rows. Default 30s. */
  syncTimeoutMs?: number;
}

export interface OffloadQuestResult {
  /**
   * False when the server-side undownload succeeded but PowerSync had not yet
   * removed the local rows when we stopped waiting. They disappear on the
   * next completed sync; nothing is left to do.
   */
  localRowsRemoved: boolean;
}

const DEFAULT_SYNC_TIMEOUT_MS = 30_000;
const SYNC_POLL_INTERVAL_MS = 500;

/**
 * Finds assets that are shared by multiple quests on the device.
 * An asset is considered "shared" if it's linked to at least one quest other than the one being offloaded.
 *
 * @param questId - The quest being offloaded (to exclude from the check)
 * @param assetIds - Asset IDs to check for sharing
 * @returns Set of asset IDs that are shared by other quests
 */
async function findSharedAssets(
  questId: string,
  assetIds: string[]
): Promise<Set<string>> {
  if (assetIds.length === 0) {
    return new Set();
  }

  console.log(
    `🔍 [Offload] Checking ${assetIds.length} assets for sharing with other quests...`
  );

  const sharedAssets = new Set<string>();

  try {
    // Check each asset to see if it's linked to any quest other than the one being offloaded
    for (const assetId of assetIds) {
      const allLinks = await system.db.query.quest_asset_link.findMany({
        where: (link, { eq: eqFn }) => eqFn(link.asset_id, assetId)
      });

      // Filter out links to the quest being offloaded
      const otherQuestLinks = allLinks.filter(
        (link) => link.quest_id !== questId
      );

      if (otherQuestLinks.length > 0) {
        sharedAssets.add(assetId);
        console.log(
          `🔍 [Offload] Asset ${assetId} is shared by ${otherQuestLinks.length} other quest(s): ${otherQuestLinks.map((l) => l.quest_id).join(', ')}`
        );
      }
    }

    console.log(
      `🔍 [Offload] Found ${sharedAssets.size} shared assets out of ${assetIds.length} total`
    );
  } catch (error) {
    console.error('❌ [Offload] Error checking for shared assets:', error);
    // If we can't check, be conservative and assume all assets are shared
    // This prevents accidental deletion of shared assets
    return new Set(assetIds);
  }

  return sharedAssets;
}

/**
 * Filters verifiedIds to exclude shared assets and all their dependencies.
 * This ensures we don't remove download profiles for assets that are still needed by other quests.
 *
 * Quest-owned rows (the quest, its quest_asset_link and quest_tag_link rows)
 * are always kept: a link row belongs to exactly one quest, so undownloading
 * it cannot affect the other quest that shares the asset.
 *
 * @param questId - The quest being offloaded
 * @param verifiedIds - The original verified IDs
 * @returns Filtered verified IDs with shared assets and their dependencies excluded
 */
async function filterSharedAssetsFromVerifiedIds(
  questId: string,
  verifiedIds: VerifiedIds
): Promise<VerifiedIds> {
  // Find shared assets
  const sharedAssets = await findSharedAssets(questId, verifiedIds.assetIds);

  // Only this quest's own links, whatever the asset's sharing state.
  const questAssetLinkIds = verifiedIds.questAssetLinkIds.filter((linkId) => {
    const [linkQuestId] = linkId.split('|');
    return linkQuestId === questId;
  });

  if (sharedAssets.size === 0) {
    console.log('✅ [Offload] No shared assets found, proceeding with all IDs');
    return { ...verifiedIds, questAssetLinkIds };
  }

  console.log(
    `⚠️ [Offload] Excluding ${sharedAssets.size} shared assets and their dependencies from bulk undownload`
  );

  // Filter out shared assets
  const filteredAssetIds = verifiedIds.assetIds.filter(
    (id) => !sharedAssets.has(id)
  );

  // Filter out asset-content links for shared assets
  // We need to query which asset_content_link entries belong to shared assets
  const filteredAssetContentLinkIds: string[] = [];
  if (
    verifiedIds.assetContentLinkIds.length > 0 &&
    filteredAssetIds.length > 0
  ) {
    const assetContentLinks = await system.db.query.asset_content_link.findMany(
      {
        where: (link, { inArray: inArrayFn }) =>
          inArrayFn(link.id, verifiedIds.assetContentLinkIds)
      }
    );

    for (const link of assetContentLinks) {
      if (!sharedAssets.has(link.asset_id)) {
        filteredAssetContentLinkIds.push(link.id);
      }
    }
  }

  // Filter out asset-tag links for shared assets
  const filteredAssetTagLinkIds = verifiedIds.assetTagLinkIds.filter(
    (linkId) => {
      const [assetId] = linkId.split('|');
      return assetId && !sharedAssets.has(assetId);
    }
  );

  // Filter out votes for shared assets
  const filteredVoteIds: string[] = [];
  if (verifiedIds.voteIds.length > 0 && filteredAssetIds.length > 0) {
    const votes = await system.db.query.vote.findMany({
      where: (vote, { inArray: inArrayFn }) =>
        inArrayFn(vote.id, verifiedIds.voteIds)
    });

    for (const vote of votes) {
      if (!sharedAssets.has(vote.asset_id)) {
        filteredVoteIds.push(vote.id);
      }
    }
  }

  const filtered: VerifiedIds = {
    questIds: verifiedIds.questIds, // Quest itself should still be removed
    projectIds: verifiedIds.projectIds, // Project may be shared, but we handle this conservatively elsewhere
    questAssetLinkIds,
    assetIds: filteredAssetIds,
    assetContentLinkIds: filteredAssetContentLinkIds,
    voteIds: filteredVoteIds,
    questTagLinkIds: verifiedIds.questTagLinkIds, // Quest-tag links are quest-specific
    assetTagLinkIds: filteredAssetTagLinkIds,
    tagIds: verifiedIds.tagIds, // Tags may be shared, but we handle this conservatively elsewhere
    languageIds: verifiedIds.languageIds, // Languages may be shared, but we handle this conservatively elsewhere
    // Languoids are intentionally preserved - they're shared resources
    languoidIds: [],
    languoidAliasIds: [],
    languoidSourceIds: [],
    languoidPropertyIds: [],
    languoidRegionIds: [],
    regionIds: [],
    regionAliasIds: [],
    regionSourceIds: [],
    regionPropertyIds: [],
    // Audio files stay on disk regardless (never-delete rule); pass through.
    attachmentIds: verifiedIds.attachmentIds
  };

  console.log(
    `✅ [Offload] Filtered IDs - Assets: ${filtered.assetIds.length}/${verifiedIds.assetIds.length}, Quest-Asset Links: ${filtered.questAssetLinkIds.length}/${verifiedIds.questAssetLinkIds.length}, Asset-Content Links: ${filtered.assetContentLinkIds.length}/${verifiedIds.assetContentLinkIds.length}, Votes: ${filtered.voteIds.length}/${verifiedIds.voteIds.length}`
  );

  return filtered;
}

/**
 * Wait for PowerSync to remove the quest row after the server dropped this
 * profile from its download_profiles. Resolves true when the row is gone,
 * false on timeout.
 */
async function waitForLocalQuestRemoval(
  questId: string,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await system.db.query.quest.findFirst({
      where: (quest, { eq }) => eq(quest.id, questId),
      columns: { id: true }
    });
    if (!row) return true;
    await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Offload a quest from this device after verification.
 *
 * CRITICAL: This function assumes all cloud verification has been completed.
 *
 * The only mutation is server-side: `remove_from_download_profiles` for every
 * verified row that is not shared with another downloaded quest. PowerSync
 * then removes the rows from the local database on the next sync, exactly as
 * it added them on download. Nothing is deleted locally on purpose: local
 * deletes on synced tables enter ps_crud and are replayed on the server as
 * DELETE ops. RLS rejects them for published rows, but it lets the creator
 * delete draft rows and anyone delete their own votes, so a local cleanup
 * would turn into a real deletion (and, for acl rows, queue the audio
 * objects for removal from Storage).
 *
 * Audio files stay on disk (never-delete rule; see the attachment plan).
 *
 * Ryder: Future partial offload - Add a `categories` parameter to selectively
 * undownload. Would need category-specific verification.
 *
 * @throws Error if the quest is a draft or the server undownload fails
 */
export async function offloadQuest(
  params: OffloadQuestParams
): Promise<OffloadQuestResult> {
  const {
    questId,
    verifiedIds,
    onProgress,
    syncTimeoutMs = DEFAULT_SYNC_TIMEOUT_MS
  } = params;

  console.log(`🗑️ [Offload] Starting offload for quest: ${questId}`);

  try {
    // STEP 0: Never offload a draft. The verification hook refuses too; this
    // is the last line of defence against a UI path that skips it.
    const localQuest = await system.db.query.quest.findFirst({
      where: (quest, { eq }) => eq(quest.id, questId),
      columns: { id: true, published_at: true }
    });
    if (!localQuest) {
      throw new Error(`Quest ${questId} not found locally`);
    }
    if (localQuest.published_at == null) {
      throw new Error(
        `Quest ${questId} is unpublished; drafts cannot be offloaded`
      );
    }

    // STEP 1: Filter out shared assets before undownloading
    console.log('🔍 [Offload] Checking for shared assets...');
    onProgress?.(5, 'Checking for shared assets...');
    const filteredVerifiedIds = await filterSharedAssetsFromVerifiedIds(
      questId,
      verifiedIds
    );

    // STEP 2: Remove profile from cloud download_profiles arrays using bulk undownload
    // Only undownload assets and their dependencies that are NOT shared by other quests
    console.log(
      '🔄 [Offload] Starting bulk undownload (excluding shared assets)...'
    );
    onProgress?.(15, 'Removing from cloud download profiles...');

    const bulkResult = await bulkUndownloadQuest(filteredVerifiedIds);
    console.log('✅ [Offload] Cloud download profiles updated:', bulkResult);

    // STEP 3: Let PowerSync remove the local rows
    console.log('⏳ [Offload] Waiting for PowerSync to remove local rows...');
    onProgress?.(60, 'Waiting for sync to remove local copies...');
    const localRowsRemoved = await waitForLocalQuestRemoval(
      questId,
      syncTimeoutMs
    );

    if (localRowsRemoved) {
      console.log('✅ [Offload] Quest offloaded; local rows removed by sync');
    } else {
      console.warn(
        `⚠️ [Offload] Server undownload done, but local rows are still present after ${syncTimeoutMs}ms; they will be removed by the next completed sync`
      );
    }

    onProgress?.(100, 'Offload complete');
    return { localRowsRemoved };
  } catch (error) {
    console.error('❌ [Offload] Failed to offload quest:', error);
    throw error;
  }
}
