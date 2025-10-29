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
    // STEP 1: Remove profile from cloud download_profiles arrays using bulk undownload
    console.log('🔄 [Offload] Starting bulk undownload...');
    onProgress?.(5, 'Removing from cloud download profiles...');

    const bulkResult = await bulkUndownloadQuest(verifiedIds);
    console.log('✅ [Offload] Cloud download profiles updated:', bulkResult);

    // STEP 2: Wait for PowerSync to sync the removal (optional but helps avoid race conditions)
    console.log('⏳ [Offload] Waiting for PowerSync to sync removal...');
    onProgress?.(10, 'Syncing changes...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // STEP 3: Clean up any remaining local records
    console.log('🗑️ [Offload] Cleaning up local records...');
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
      // ============================================================================

      // Step 1: Delete votes (depends on assets)
      updateProgress('Deleting votes...');
      if (verifiedIds.voteIds.length > 0) {
        await tx
          .delete(drizzleSchemaLocal.vote_local)
          .where(
            inArray(drizzleSchemaLocal.vote_local.id, verifiedIds.voteIds)
          );
        console.log(`✅ [Offload] Deleted ${verifiedIds.voteIds.length} votes`);
      }

      // Step 2: Delete asset-tag links
      updateProgress('Deleting asset-tag links...');
      if (verifiedIds.assetTagLinkIds.length > 0) {
        // Parse composite keys
        const assetTagPairs = verifiedIds.assetTagLinkIds.map((id) => {
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
          `✅ [Offload] Deleted ${assetTagPairs.length} asset-tag links`
        );
      }

      // Step 3: Delete quest-tag links
      updateProgress('Deleting quest-tag links...');
      if (verifiedIds.questTagLinkIds.length > 0) {
        // Parse composite keys
        const questTagPairs = verifiedIds.questTagLinkIds.map((id) => {
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

      // Step 5: Delete asset-content links
      updateProgress('Deleting asset-content links...');
      if (verifiedIds.assetContentLinkIds.length > 0) {
        await tx
          .delete(drizzleSchemaLocal.asset_content_link_local)
          .where(
            inArray(
              drizzleSchemaLocal.asset_content_link_local.id,
              verifiedIds.assetContentLinkIds
            )
          );
        console.log(
          `✅ [Offload] Deleted ${verifiedIds.assetContentLinkIds.length} asset-content links`
        );
      }

      // Step 6: Delete attachments from attachment queue
      updateProgress('Cleaning up attachments...');
      if (verifiedIds.attachmentIds.length > 0) {
        // Delete from attachments table
        for (const attachmentId of verifiedIds.attachmentIds) {
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
          `✅ [Offload] Cleaned up ${verifiedIds.attachmentIds.length} attachments`
        );
      }

      // Step 7: Delete assets
      updateProgress('Deleting assets...');
      if (verifiedIds.assetIds.length > 0) {
        await tx
          .delete(drizzleSchemaLocal.asset_local)
          .where(
            inArray(drizzleSchemaLocal.asset_local.id, verifiedIds.assetIds)
          );
        console.log(
          `✅ [Offload] Deleted ${verifiedIds.assetIds.length} assets`
        );
      }

      // Step 8: Delete quest-asset links
      updateProgress('Deleting quest-asset links...');
      if (verifiedIds.questAssetLinkIds.length > 0) {
        // Parse composite keys
        const questAssetPairs = verifiedIds.questAssetLinkIds.map((id) => {
          const [questId, assetId] = id.split('|');
          return { questId: questId!, assetId: assetId! };
        });

        // Delete each link
        for (const { questId: qId, assetId } of questAssetPairs) {
          await tx
            .delete(drizzleSchemaLocal.quest_asset_link_local)
            .where(eq(drizzleSchemaLocal.quest_asset_link_local.quest_id, qId));
        }
        console.log(
          `✅ [Offload] Deleted ${questAssetPairs.length} quest-asset links`
        );
      }

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
