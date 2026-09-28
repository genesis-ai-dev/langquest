import { eq, inArray } from 'drizzle-orm';
// import { db } from '../db/database';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { isImportedAsset } from '@/utils/assetProvenance';
import { resolveTable } from '@/utils/dbUtils';
import { withQuestVersionLabel } from '@/utils/questVersionLabel';
import uuid from 'react-native-uuid';
import { quest } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

// export type QuestWithRelations = typeof quest.$inferSelect & {
//   tags: (typeof tag.$inferSelect)[];
// };

const MAX_RECORDING_SESSIONS = 10;

export type Quest = typeof quest.$inferSelect;

export class QuestService {
  async getQuestsByProjectId(project_id: string): Promise<Quest[]> {
    return db.select().from(quest).where(eq(quest.project_id, project_id));
  }

  async getQuestById(quest_id: string) {
    return (
      await db.select().from(quest).where(eq(quest.id, quest_id)).limit(1)
    )[0];
  }
}

export const questService = new QuestService();

export async function updateQuestVersionLabel(
  quest_id: string,
  versionLabel: string,
  existingMetadata: unknown
): Promise<void> {
  const trimmed = versionLabel.trim();
  if (!trimmed) {
    throw new Error('Version label cannot be empty');
  }

  const parsed = parseQuestMetadata(existingMetadata);
  await updateQuestMetadata(quest_id, withQuestVersionLabel(parsed, trimmed));
}

export async function updateQuestMetadata(
  quest_id: string,
  metadata: QuestMetadata
): Promise<void> {
  try {
    const questLocalTable = resolveTable('quest', { localOverride: true });
    const updatedRows = await system.db
      .update(questLocalTable)
      .set({ metadata })
      .where(eq(questLocalTable.id, quest_id))
      .returning({ id: questLocalTable.id });
    if (updatedRows.length === 0) {
      throw new Error('Quest not found');
    }
  } catch (error) {
    console.error('Failed to update quest metadata:', error);
    throw error;
  }
}

export function parseQuestMetadata(rawMetadata: unknown): QuestMetadata {
  if (!rawMetadata) return {};
  if (typeof rawMetadata === 'string') {
    try {
      const parsed = JSON.parse(rawMetadata);
      return parsed && typeof parsed === 'object'
        ? (parsed as QuestMetadata)
        : {};
    } catch {
      return {};
    }
  }
  return typeof rawMetadata === 'object' ? (rawMetadata as QuestMetadata) : {};
}

/**
 * Resolves the session id used to highlight assets recorded in the latest session.
 * Prefers the in-memory recording session while the quest query may still be stale.
 */
export function getEffectiveLastRecordingSessionId(
  questMetadata: unknown,
  activeRecordingSessionId?: string
): string | undefined {
  const parsed = parseQuestMetadata(questMetadata);
  return activeRecordingSessionId ?? parsed.lastRecordingSessionId;
}

export async function createQuestRecordingSession(
  quest_id: string
): Promise<string> {
  try {
    const questLocalTable = resolveTable('quest', { localOverride: true });
    const existingQuestRows = await system.db
      .select({
        metadata: questLocalTable.metadata
      })
      .from(questLocalTable)
      .where(eq(questLocalTable.id, quest_id))
      .limit(1);
    const existingQuest = existingQuestRows[0];

    if (!existingQuest) {
      throw new Error('Quest not found');
    }

    const existingMetadata = parseQuestMetadata(existingQuest.metadata);
    const recordingSessionId = String(uuid.v4());
    const nextRecordingSessions = [
      ...(existingMetadata.recordingSessions ?? []),
      {
        id: recordingSessionId,
        created_at: new Date().toISOString()
      }
    ].slice(-MAX_RECORDING_SESSIONS);

    const updatedMetadata: QuestMetadata = {
      ...existingMetadata,
      lastRecordingSessionId: recordingSessionId,
      recordingSessions: nextRecordingSessions
    };

    console.log('[updatedMetadata]', updatedMetadata);

    await updateQuestMetadata(quest_id, updatedMetadata);
    return recordingSessionId;
  } catch (error) {
    console.error('Failed to create quest recording session:', error);
    throw error;
  }
}

/**
 * Permanently deletes a local-only (unpublished) quest.
 * Throws if the quest is missing or already exists in the synced table.
 * Imported assets are kept; only their quest_asset_link is removed.
 */
export async function deleteUnpublishedQuest(questId: string): Promise<void> {
  if (!questId) {
    throw new Error('Quest id is required');
  }

  const questLocalTable = resolveTable('quest', { localOverride: true });
  const questSyncedTable = resolveTable('quest', { localOverride: false });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });
  const questTagLinkLocal = resolveTable('quest_tag_link', {
    localOverride: true
  });
  const assetLocal = resolveTable('asset', { localOverride: true });
  const assetContentLocal = resolveTable('asset_content_link', {
    localOverride: true
  });
  const assetTagLinkLocal = resolveTable('asset_tag_link', {
    localOverride: true
  });
  const voteLocal = resolveTable('vote', { localOverride: true });

  try {
    const [localQuest] = await system.db
      .select({ id: questLocalTable.id })
      .from(questLocalTable)
      .where(eq(questLocalTable.id, questId))
      .limit(1);

    if (!localQuest) {
      throw new Error('Quest not found');
    }

    const [publishedQuest] = await system.db
      .select({ id: questSyncedTable.id })
      .from(questSyncedTable)
      .where(eq(questSyncedTable.id, questId))
      .limit(1);

    if (publishedQuest) {
      throw new Error('Cannot delete a published quest');
    }

    const links = await system.db
      .select({
        asset_id: questAssetLinkLocal.asset_id,
        metadata: questAssetLinkLocal.metadata
      })
      .from(questAssetLinkLocal)
      .where(eq(questAssetLinkLocal.quest_id, questId));

    const deletableAssetIds = links
      .filter((link) => !isImportedAsset(link.metadata))
      .map((link) => link.asset_id);

    await system.db.transaction(async (tx) => {
      await tx
        .delete(questAssetLinkLocal)
        .where(eq(questAssetLinkLocal.quest_id, questId));

      if (deletableAssetIds.length > 0) {
        const childAssets = await tx
          .select({ id: assetLocal.id })
          .from(assetLocal)
          .where(inArray(assetLocal.source_asset_id, deletableAssetIds));

        const uniqueAssetIds = Array.from(
          new Set([
            ...childAssets.map((child) => child.id),
            ...deletableAssetIds
          ])
        );

        await tx
          .delete(voteLocal)
          .where(inArray(voteLocal.asset_id, uniqueAssetIds));
        await tx
          .delete(assetTagLinkLocal)
          .where(inArray(assetTagLinkLocal.asset_id, uniqueAssetIds));
        await tx
          .delete(questAssetLinkLocal)
          .where(inArray(questAssetLinkLocal.asset_id, uniqueAssetIds));
        await tx
          .delete(assetContentLocal)
          .where(inArray(assetContentLocal.asset_id, uniqueAssetIds));
        await tx
          .delete(assetLocal)
          .where(inArray(assetLocal.id, uniqueAssetIds));
      }

      await tx
        .delete(questTagLinkLocal)
        .where(eq(questTagLinkLocal.quest_id, questId));
      await tx
        .delete(questLocalTable)
        .where(eq(questLocalTable.id, questId));
    });
  } catch (error) {
    console.error('Failed to delete unpublished quest:', error);
    throw error;
  }
}
