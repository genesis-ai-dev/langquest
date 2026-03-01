/**
 * Recording Service - Database operations for audio recording
 *
 * MODEL LAYER - Handles all database writes for recording
 * Delegates to createLocalAssetInTx for the actual insert logic.
 */

import { createLocalAssetInTx } from '@/database_services/assetService';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { eq } from 'drizzle-orm';

// Asset metadata interface (verse information)
export interface AssetMetadata {
  verse?: {
    from: number;
    to: number;
  };
  recordingSessionId?: string;
}

export interface SaveRecordingParams {
  questId: string;
  projectId: string;
  targetLanguoidId: string;
  userId: string;
  orderIndex: number;
  audioUri: string;
  assetName: string;
  metadata?: AssetMetadata | null;
}

/**
 * Save a new recording to the database.
 * Shifts existing assets if needed, creates asset + quest link + content link.
 * Returns the new asset ID.
 */
export async function saveRecording(
  params: SaveRecordingParams
): Promise<string> {
  const {
    questId,
    projectId,
    targetLanguoidId,
    userId,
    orderIndex,
    audioUri,
    assetName,
    metadata
  } = params;

  console.log(
    `💾 Saving recording | name: ${assetName} | order_index: ${orderIndex}`
  );

  let newAssetId: string = '';

  await system.db.transaction(async (tx) => {
    newAssetId = await createLocalAssetInTx(tx, {
      name: assetName,
      orderIndex,
      questId,
      projectId,
      userId,
      languoidId: targetLanguoidId,
      audio: [audioUri],
      text: assetName,
      assetMetadata: metadata ?? null,
      shiftExisting: true
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
