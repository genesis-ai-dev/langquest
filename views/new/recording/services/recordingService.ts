/**
 * Recording Service - Database operations for audio recording
 *
 * MODEL LAYER - Handles all database writes for recording
 * Responsibilities:
 * - Insert new assets with proper order_index
 * - Shift existing assets when inserting in middle
 * - Create quest_asset_link and asset_content_link
 * - Maintain data integrity
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, gte } from 'drizzle-orm';
import uuid from 'react-native-uuid';

export interface SaveRecordingParams {
  questId: string;
  projectId: string;
  targetLanguageId: string;
  userId: string;
  orderIndex: number;
  audioUri: string;
  assetName: string; // Pre-determined asset name (reserved to prevent duplicates)
}

/**
 * Save a new recording to the database
 * - Shifts existing assets if needed
 * - Creates asset, quest link, and content link
 * - Returns the new asset ID
 * - Asset name should be pre-determined and reserved by caller to prevent duplicates
 */
export async function saveRecording(
  params: SaveRecordingParams
): Promise<string> {
  const { questId, projectId, targetLanguageId, userId, orderIndex, audioUri, assetName } =
    params;

  const newAssetId = String(uuid.v4());

  console.log(
    `💾 Saving recording | name: ${assetName} | order_index: ${orderIndex}`
  );

  await system.db.transaction(async (tx) => {
    const assetLocal = resolveTable('asset', { localOverride: true });
    const linkLocal = resolveTable('quest_asset_link', { localOverride: true });
    const contentLocal = resolveTable('asset_content_link', {
      localOverride: true
    });

    // 1. Shift existing assets at or after target order_index
    const assetsToShift = await tx
      .select({
        id: assetLocal.id,
        order_index: assetLocal.order_index
      })
      .from(assetLocal)
      .innerJoin(linkLocal, eq(assetLocal.id, linkLocal.asset_id))
      .where(
        and(
          eq(linkLocal.quest_id, questId),
          gte(assetLocal.order_index, orderIndex)
        )
      );

    if (assetsToShift.length > 0) {
      console.log(`  📊 Shifting ${assetsToShift.length} existing assets`);
      for (const asset of assetsToShift) {
        if (typeof asset.order_index === 'number') {
          await tx
            .update(assetLocal)
            .set({ order_index: asset.order_index + 1 })
            .where(eq(assetLocal.id, asset.id));
        }
      }
    }

    // 2. Insert new asset
    const [newAsset] = await tx
      .insert(assetLocal)
      .values({
        id: newAssetId,
        name: assetName,
        order_index: orderIndex,
        source_language_id: targetLanguageId,
        project_id: projectId,
        creator_id: userId,
        download_profiles: [userId]
      })
      .returning();

    if (!newAsset) {
      throw new Error('Failed to insert asset');
    }

    // 3. Link to quest
    await tx.insert(linkLocal).values({
      id: String(uuid.v4()),
      quest_id: questId,
      asset_id: newAssetId,
      download_profiles: [userId]
    });

    // 4. Add audio content
    await tx.insert(contentLocal).values({
      asset_id: newAssetId,
      source_language_id: targetLanguageId,
      text: assetName,
      audio: [audioUri],
      download_profiles: [userId]
    });
  });

  console.log(`✅ Saved | ${assetName} | ${newAssetId.slice(0, 8)}`);
  return newAssetId;
}

/**
 * Get the next available order_index for a quest
 * Useful for initializing VAD counter
 */
export async function getNextOrderIndex(questId: string): Promise<number> {
  const assetLocal = resolveTable('asset', { localOverride: true });
  const linkLocal = resolveTable('quest_asset_link', { localOverride: true });

  const assets = await system.db
    .select({ order_index: assetLocal.order_index })
    .from(assetLocal)
    .innerJoin(linkLocal, eq(assetLocal.id, linkLocal.asset_id))
    .where(eq(linkLocal.quest_id, questId));

  const maxOrder = Math.max(
    ...assets.map((a) =>
      typeof a.order_index === 'number' ? a.order_index : 0
    ),
    -1
  );

  return maxOrder + 1;
}
