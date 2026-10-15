import { and, asc, eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { linkExistingAssetsToQuest } from '@/database_services/assetService';
import type { QuestAssetLinkMetadata } from '@/database_services/assetService';
import { getReviewLabel } from '@/database_services/reviewService';
import type {
  AssetResult,
  QuestResult
} from '@/database_services/reviewService';
import type { QuestMetadata, ReviewSnapshot } from '@/db/drizzleSchemaColumns';
import { resolveTable } from '@/utils/dbUtils';
import {
  allocateQuestVersionLabel,
  withQuestVersionLabel
} from '@/utils/questVersionLabel';
import uuid from 'react-native-uuid';
import {
  quest,
  quest_asset_link,
  review,
  review_asset
} from '../db/drizzleSchema';
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

function verseFromLinkMetadata(
  metadata: unknown
): { from: number; to: number } | undefined {
  let value = metadata;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!value || typeof value !== 'object') return undefined;
  const verse = (value as { verse?: { from?: unknown; to?: unknown } }).verse;
  if (typeof verse?.from !== 'number' || typeof verse.to !== 'number') {
    return undefined;
  }
  return { from: verse.from, to: verse.to };
}

function reviewAssetRowId(
  reviewId: string,
  assetId: string,
  id: string | null
) {
  const trimmed = id?.trim();
  // Published rows have no server id; PowerSync uses review_id + asset_id.
  return trimmed || `${reviewId}_${assetId}`;
}

function toReviewResult(value: string | null): QuestResult | undefined {
  return value === 'suggested_changes' || value === 'approved'
    ? value
    : undefined;
}

function toAssetResult(value: string | null): AssetResult | undefined {
  return value === 'suggested_changes' ||
    value === 'approved' ||
    value === 'not_reviewed'
    ? value
    : undefined;
}

async function reviewSnapshotsByAsset(
  reviewId: string
): Promise<Map<string, ReviewSnapshot>> {
  // review_asset has no active column on the server, so synced rows must not
  // be filtered by it.
  const rows = await system.db
    .select({
      id: review_asset.id,
      asset_id: review_asset.asset_id,
      asset_result: review_asset.asset_result,
      comment: review_asset.comment,
      audio: review_asset.audio,
      source: review_asset.source
    })
    .from(review_asset)
    .where(eq(review_asset.review_id, reviewId));

  const byAsset = new Map<
    string,
    { snapshot: ReviewSnapshot; source: string }
  >();
  for (const row of rows) {
    const assetId = row.asset_id.toLowerCase();
    const existing = byAsset.get(assetId);
    if (existing?.source === 'synced') continue;
    const result = toAssetResult(row.asset_result);
    const hasStatus = result === 'approved' || result === 'suggested_changes';
    const hasFeedback =
      !!row.comment?.trim() ||
      (Array.isArray(row.audio) && row.audio.length > 0);
    // Rows touched and then cleared carry nothing worth showing on the card.
    if (!hasStatus && !hasFeedback) continue;
    byAsset.set(assetId, {
      snapshot: {
        id: reviewAssetRowId(reviewId, row.asset_id, row.id),
        ...(result ? { result } : {})
      },
      source: row.source
    });
  }
  return new Map([...byAsset].map(([assetId, row]) => [assetId, row.snapshot]));
}

export interface CreateQuestVersionResult {
  questId: string;
  questName: string;
  projectId: string;
}

/**
 * Creates a local draft quest from an existing quest and imports that quest's
 * assets into it. Pass reviewId when the draft starts from a published review.
 */
export async function createQuestVersionFromQuest(params: {
  sourceQuestId: string;
  userId: string;
  reviewId?: string;
}): Promise<CreateQuestVersionResult> {
  const { sourceQuestId, userId, reviewId } = params;
  const source = await questService.getQuestById(sourceQuestId);
  if (!source) throw new Error('Quest not found');

  const sourceMetadata = parseQuestMetadata(source.metadata);
  const bookId = sourceMetadata.bible?.book ?? sourceMetadata.fia?.bookId;
  const segmentId = sourceMetadata.bible
    ? sourceMetadata.bible.chapter
    : sourceMetadata.fia?.pericopeId;
  const versionLabel =
    bookId && segmentId != null
      ? await allocateQuestVersionLabel(source.project_id, bookId, segmentId)
      : undefined;

  let reviewSnapshot: ReviewSnapshot | undefined;
  let assetReviews = new Map<string, ReviewSnapshot>();
  if (reviewId) {
    const [reviewRow] = await system.db
      .select({
        metadata: review.metadata,
        quest_result: review.quest_result
      })
      .from(review)
      .where(eq(review.id, reviewId))
      .limit(1);
    if (!reviewRow) throw new Error('Review not found');
    const label = getReviewLabel(reviewRow.metadata);
    const result = toReviewResult(reviewRow.quest_result);
    reviewSnapshot = {
      id: reviewId,
      ...(label ? { label } : {}),
      ...(result ? { result } : {})
    };
    assetReviews = await reviewSnapshotsByAsset(reviewId);
  }

  const metadata: QuestMetadata = {
    ...(sourceMetadata.bible ? { bible: sourceMetadata.bible } : {}),
    ...(sourceMetadata.fia ? { fia: sourceMetadata.fia } : {}),
    ...(sourceMetadata.allowImportAssets ? { allowImportAssets: true } : {}),
    ...(versionLabel ? { versionLabel } : {}),
    ...(reviewSnapshot ? { review: reviewSnapshot } : {})
  };

  const questLocal = resolveTable('quest', { localOverride: true });
  const [created] = await system.db
    .insert(questLocal)
    .values({
      name: source.name,
      description: source.description,
      project_id: source.project_id,
      parent_id: source.parent_id,
      creator_id: userId,
      download_profiles: [userId],
      metadata
    })
    .returning({ id: questLocal.id, name: questLocal.name });

  if (!created) throw new Error('Failed to create quest');

  const recordingSessionId = await createQuestRecordingSession(created.id);

  const linkRows = await system.db
    .select({
      asset_id: quest_asset_link.asset_id,
      name: quest_asset_link.name,
      order_index: quest_asset_link.order_index,
      metadata: quest_asset_link.metadata,
      source: quest_asset_link.source
    })
    .from(quest_asset_link)
    .where(
      and(
        eq(quest_asset_link.quest_id, sourceQuestId),
        eq(quest_asset_link.active, true)
      )
    )
    .orderBy(asc(quest_asset_link.order_index));

  const linksByAsset = new Map<string, (typeof linkRows)[number]>();
  for (const row of linkRows) {
    const existing = linksByAsset.get(row.asset_id);
    if (existing?.source === 'synced') continue;
    linksByAsset.set(row.asset_id, row);
  }

  await linkExistingAssetsToQuest({
    questId: created.id,
    userId,
    items: [...linksByAsset.values()].map((row) => {
      const verse = verseFromLinkMetadata(row.metadata);
      const assetReview = assetReviews.get(row.asset_id.toLowerCase());
      const linkMetadata: QuestAssetLinkMetadata = {
        ...(verse ? { verse } : {}),
        recordingSessionId,
        provenance: { type: 'imported' },
        ...(assetReview ? { review: assetReview } : {})
      };
      return {
        assetId: row.asset_id,
        name: row.name,
        order_index: row.order_index,
        metadata: linkMetadata
      };
    })
  });

  return {
    questId: created.id,
    questName: created.name,
    projectId: source.project_id
  };
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
