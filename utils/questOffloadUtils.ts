import * as drizzleSchemaLocal from '@/db/drizzleSchemaLocal';
import { system } from '@/db/powersync/system';
import type { VerifiedIds } from '@/hooks/useQuestOffloadVerification';
import { bulkUndownloadQuest } from '@/utils/bulkUndownload';
import { eq, inArray } from 'drizzle-orm';

interface OffloadQuestParams {
  questId: string;
  verifiedIds: VerifiedIds;
  onProgress?: (progress: number, message: string) => void;
}

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

  if (sharedAssets.size === 0) {
    console.log('✅ [Offload] No shared assets found, proceeding with all IDs');
    return verifiedIds;
  }

  console.log(
    `⚠️ [Offload] Excluding ${sharedAssets.size} shared assets and their dependencies from bulk undownload`
  );

  // Filter out shared assets
  const filteredAssetIds = verifiedIds.assetIds.filter(
    (id) => !sharedAssets.has(id)
  );

  // Filter out quest-asset links for shared assets
  const filteredQuestAssetLinkIds = verifiedIds.questAssetLinkIds.filter(
    (linkId) => {
      const [linkQuestId, linkAssetId] = linkId.split('|');
      // Only keep links that are for this quest AND not for shared assets
      return (
        linkQuestId === questId && linkAssetId && !sharedAssets.has(linkAssetId)
      );
    }
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
  } else if (verifiedIds.assetContentLinkIds.length > 0) {
    // If all assets were shared, no content links should be removed
    filteredAssetContentLinkIds.length = 0;
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

  // Filter out attachment IDs for shared assets
  // We need to check which attachments belong to shared asset content links
  const filteredAttachmentIds: string[] = [];
  if (verifiedIds.attachmentIds.length > 0) {
    // Get all asset_content_link entries to find which attachments are for shared assets
    const allAssetContentLinks =
      await system.db.query.asset_content_link.findMany({
        where: (link, { inArray: inArrayFn }) =>
          inArrayFn(link.asset_id, verifiedIds.assetIds)
      });

    const sharedAssetContentLinkIds = new Set(
      allAssetContentLinks
        .filter((link) => sharedAssets.has(link.asset_id))
        .flatMap((link) => link.audio || [])
        .filter(Boolean)
    );

    filteredAttachmentIds.push(
      ...verifiedIds.attachmentIds.filter(
        (id) => !sharedAssetContentLinkIds.has(id)
      )
    );
  }

  const filtered: VerifiedIds = {
    questIds: verifiedIds.questIds, // Quest itself should still be removed
    projectIds: verifiedIds.projectIds, // Project may be shared, but we handle this conservatively elsewhere
    questAssetLinkIds: filteredQuestAssetLinkIds,
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
    attachmentIds: filteredAttachmentIds
  };

  console.log(
    `✅ [Offload] Filtered IDs - Assets: ${filtered.assetIds.length}/${verifiedIds.assetIds.length}, Quest-Asset Links: ${filtered.questAssetLinkIds.length}/${verifiedIds.questAssetLinkIds.length}, Asset-Content Links: ${filtered.assetContentLinkIds.length}/${verifiedIds.assetContentLinkIds.length}, Votes: ${filtered.voteIds.length}/${verifiedIds.voteIds.length}, Attachments: ${filtered.attachmentIds.length}/${verifiedIds.attachmentIds.length}`
  );

  return filtered;
}

/**
 * Safely offload a quest from local storage after verification.
 *
 * CRITICAL: This function assumes all cloud verification has been completed.
 * It deletes local records in reverse dependency order to avoid foreign key issues.
 *
 * Ryder: Future partial offload - Add a `categories` parameter to selectively delete.
 * E.g., `{ deleteAudio: true, keepTranslations: true }` would only remove attachment records.
 * Would need category-specific verification and deletion logic.
 *
 * @param params - Quest ID, verified IDs, and optional progress callback
 * @throws Error if deletion fails
 */
export async function offloadQuest(params: OffloadQuestParams): Promise<void> {
  const { questId, verifiedIds, onProgress } = params;

  console.log(`🗑️ [Offload] Starting offload for quest: ${questId}`);

  try {
    // STEP 0: Filter out shared assets before undownloading
    console.log('🔍 [Offload] Checking for shared assets...');
    onProgress?.(2, 'Checking for shared assets...');
    const filteredVerifiedIds = await filterSharedAssetsFromVerifiedIds(
      questId,
      verifiedIds
    );

    // STEP 1: Remove profile from cloud download_profiles arrays using bulk undownload
    // Only undownload assets and their dependencies that are NOT shared by other quests
    console.log(
      '🔄 [Offload] Starting bulk undownload (excluding shared assets)...'
    );
    onProgress?.(5, 'Removing from cloud download profiles...');

    const bulkResult = await bulkUndownloadQuest(filteredVerifiedIds);
    console.log('✅ [Offload] Cloud download profiles updated:', bulkResult);

    // STEP 2: Wait for PowerSync to sync the removal (optional but helps avoid race conditions)
    console.log('⏳ [Offload] Waiting for PowerSync to sync removal...');
    onProgress?.(10, 'Syncing changes...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // STEP 3: Clean up any remaining local records
    // Use filtered IDs to preserve shared assets and their dependencies locally
    console.log(
      '🗑️ [Offload] Cleaning up local records (preserving shared assets)...'
    );
    onProgress?.(15, 'Cleaning up local data...');

    await system.db.transaction(async (tx) => {
      let currentStep = 0;
      const totalSteps = 11;

      const updateProgress = (message: string) => {
        currentStep++;
        // Reserve 15% for cloud operations, use remaining 85% for local cleanup
        const progress = 15 + (currentStep / totalSteps) * 85;
        console.log(
          `🗑️ [Offload] Step ${currentStep}/${totalSteps}: ${message}`
        );
        onProgress?.(progress, message);
      };

      // ============================================================================
      // Delete in reverse dependency order to avoid foreign key violations
      // Use filteredVerifiedIds to preserve shared assets and their dependencies
      // ============================================================================

      // Step 1: Delete votes (depends on assets) - only for non-shared assets
      updateProgress('Deleting votes...');
      if (filteredVerifiedIds.voteIds.length > 0) {
        await tx
          .delete(drizzleSchemaLocal.vote_local)
          .where(
            inArray(
              drizzleSchemaLocal.vote_local.id,
              filteredVerifiedIds.voteIds
            )
          );
        console.log(
          `✅ [Offload] Deleted ${filteredVerifiedIds.voteIds.length} votes (${verifiedIds.voteIds.length - filteredVerifiedIds.voteIds.length} preserved for shared assets)`
        );
      }

      // Step 2: Delete asset-tag links - only for non-shared assets
      updateProgress('Deleting asset-tag links...');
      if (filteredVerifiedIds.assetTagLinkIds.length > 0) {
        // Parse composite keys
        const assetTagPairs = filteredVerifiedIds.assetTagLinkIds.map((id) => {
          const [assetId, tagId] = id.split('|');
          return { assetId: assetId!, tagId: tagId! };
        });

        // Delete each link (composite key requires multiple conditions)
        for (const { assetId, tagId } of assetTagPairs) {
          await tx
            .delete(drizzleSchemaLocal.asset_tag_link_local)
            .where(
              eq(drizzleSchemaLocal.asset_tag_link_local.asset_id, assetId)
            );
        }
        console.log(
          `✅ [Offload] Deleted ${assetTagPairs.length} asset-tag links (${verifiedIds.assetTagLinkIds.length - filteredVerifiedIds.assetTagLinkIds.length} preserved for shared assets)`
        );
      }

      // Step 3: Delete quest-tag links (quest-specific, always delete)
      updateProgress('Deleting quest-tag links...');
      if (filteredVerifiedIds.questTagLinkIds.length > 0) {
        // Parse composite keys
        const questTagPairs = filteredVerifiedIds.questTagLinkIds.map((id) => {
          const [questId, tagId] = id.split('|');
          return { questId: questId!, tagId: tagId! };
        });

        // Delete each link
        for (const { questId: qId, tagId } of questTagPairs) {
          await tx
            .delete(drizzleSchemaLocal.quest_tag_link_local)
            .where(eq(drizzleSchemaLocal.quest_tag_link_local.quest_id, qId));
        }
        console.log(
          `✅ [Offload] Deleted ${questTagPairs.length} quest-tag links`
        );
      }

      // Step 4: Delete tags (only if not used elsewhere)
      // Note: We're being conservative here - tags may be used by other quests
      // For now, we'll skip tag deletion to be safe
      updateProgress('Skipping tag deletion (may be used elsewhere)...');
      console.log('⏭️ [Offload] Skipping tags (may be shared across quests)');

      // Step 5: Delete asset-content links - only for non-shared assets
      updateProgress('Deleting asset-content links...');
      if (filteredVerifiedIds.assetContentLinkIds.length > 0) {
        await tx
          .delete(drizzleSchemaLocal.asset_content_link_local)
          .where(
            inArray(
              drizzleSchemaLocal.asset_content_link_local.id,
              filteredVerifiedIds.assetContentLinkIds
            )
          );
        console.log(
          `✅ [Offload] Deleted ${filteredVerifiedIds.assetContentLinkIds.length} asset-content links (${verifiedIds.assetContentLinkIds.length - filteredVerifiedIds.assetContentLinkIds.length} preserved for shared assets)`
        );
      }

      // Step 6: Delete attachments from attachment queue - only for non-shared assets
      updateProgress('Cleaning up attachments...');
      if (filteredVerifiedIds.attachmentIds.length > 0) {
        // Delete from attachments table
        for (const attachmentId of filteredVerifiedIds.attachmentIds) {
          try {
            await system.powersync.execute(
              'DELETE FROM attachments WHERE id = ?',
              [attachmentId]
            );
          } catch (error) {
            console.warn(
              `⚠️ [Offload] Failed to delete attachment ${attachmentId}:`,
              error
            );
          }
        }
        console.log(
          `✅ [Offload] Cleaned up ${filteredVerifiedIds.attachmentIds.length} attachments (${verifiedIds.attachmentIds.length - filteredVerifiedIds.attachmentIds.length} preserved for shared assets)`
        );
      }

      // Step 7: Delete assets - only non-shared assets
      updateProgress('Deleting assets...');
      if (filteredVerifiedIds.assetIds.length > 0) {
        await tx
          .delete(drizzleSchemaLocal.asset_local)
          .where(
            inArray(
              drizzleSchemaLocal.asset_local.id,
              filteredVerifiedIds.assetIds
            )
          );
        console.log(
          `✅ [Offload] Deleted ${filteredVerifiedIds.assetIds.length} assets (${verifiedIds.assetIds.length - filteredVerifiedIds.assetIds.length} preserved as shared)`
        );
      }

      // Step 8: Delete quest-asset links for this quest only
      // Delete ALL links for this quest (both shared and non-shared assets)
      // since we're removing the quest itself
      updateProgress('Deleting quest-asset links...');
      // Delete all quest-asset links for this quest, not just filtered ones
      await tx
        .delete(drizzleSchemaLocal.quest_asset_link_local)
        .where(eq(drizzleSchemaLocal.quest_asset_link_local.quest_id, questId));

      const deletedLinksCount = verifiedIds.questAssetLinkIds.length;
      console.log(
        `✅ [Offload] Deleted ${deletedLinksCount} quest-asset links for this quest (both shared and non-shared)`
      );

      // Step 9: Delete the quest itself
      updateProgress('Deleting quest...');
      await tx
        .delete(drizzleSchemaLocal.quest_local)
        .where(eq(drizzleSchemaLocal.quest_local.id, questId));
      console.log(`✅ [Offload] Deleted quest: ${questId}`);

      // Step 10: Clean up languages (only if not used elsewhere)
      // Note: We're being conservative - languages are likely shared
      updateProgress('Skipping language deletion (may be used elsewhere)...');
      console.log(
        '⏭️ [Offload] Skipping languages (likely shared across projects)'
      );

      // Step 11: Clean up project (only if not used elsewhere)
      // Note: We're being conservative - project may have other quests
      updateProgress('Skipping project deletion (may have other quests)...');
      console.log('⏭️ [Offload] Skipping project (may have other quests)');

      updateProgress('Offload complete!');
      console.log('✅ [Offload] Transaction completed successfully');
    });

    console.log(
      '✅ [Offload] Quest offloaded successfully - removed from cloud profiles and local data cleaned'
    );
  } catch (error) {
    console.error('❌ [Offload] Failed to offload quest:', error);
    throw error;
  }
}

/**
 * Estimate storage space that will be freed by offloading a quest.
 *
 * @param questId - Quest to estimate
 * @returns Estimated bytes to be freed
 */
export async function estimateOffloadSize(questId: string): Promise<number> {
  try {
    // Query local database for approximate sizes
    const result = await system.powersync.get<{ total_size: number }>(
      `
      SELECT SUM(length) as total_size
      FROM (
        SELECT length(text) as length FROM asset_content_link_local
        WHERE asset_id IN (
          SELECT asset_id FROM quest_asset_link_local WHERE quest_id = ?
        )
        UNION ALL
        SELECT length(audio) as length FROM asset_content_link_local
        WHERE asset_id IN (
          SELECT asset_id FROM quest_asset_link_local WHERE quest_id = ?
        )
      )
      `,
      [questId, questId]
    );

    return result?.total_size || 0;
  } catch (error) {
    console.error('❌ [Offload] Error estimating size:', error);
    return 0;
  }
}
