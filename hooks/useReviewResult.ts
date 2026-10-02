import { profile, quest, review, review_asset } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { AssetResult, QuestResult } from '@/database_services/reviewService';
import { getReviewAudio } from '@/database_services/reviewService';
import { formatQuestDisplayLabel } from '@/utils/questVersionLabel';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';

export interface ReviewAssetResult {
  asset_result: AssetResult;
  comment: string | null;
  audio: string[];
}

export interface ReviewResult {
  id: string;
  questLabel: string;
  creatorName: string;
  date: string;
  questResult: QuestResult | null;
  conclusion: string | null;
  audio: string[];
  assets: Map<string, ReviewAssetResult>;
}

async function fetchReviewResult(reviewId: string): Promise<ReviewResult | null> {
  const [row] = await system.db
    .select({
      id: review.id,
      questResult: review.quest_result,
      conclusion: review.conclusion,
      metadata: review.metadata,
      audio: review.audio,
      concludedAt: review.concluded_at,
      lastUpdated: review.last_updated,
      questName: quest.name,
      questMetadata: quest.metadata,
      username: profile.username
    })
    .from(review)
    .leftJoin(quest, eq(quest.id, review.quest_id))
    .leftJoin(profile, eq(profile.id, review.profile_id))
    .where(eq(review.id, reviewId))
    .limit(1);
  if (!row) return null;

  const assetRows = await system.db
    .select({
      asset_id: review_asset.asset_id,
      asset_result: review_asset.asset_result,
      comment: review_asset.comment,
      audio: review_asset.audio,
      source: review_asset.source
    })
    .from(review_asset)
    .where(eq(review_asset.review_id, reviewId));

  // The synced copy (id review_id_asset_id) and the publisher's local copy (uuid)
  // both show up in the merged view; keep one per asset, preferring synced.
  const assets = new Map<string, ReviewAssetResult & { source: string }>();
  for (const assetRow of assetRows) {
    const existing = assets.get(assetRow.asset_id);
    if (existing && existing.source === 'synced') continue;
    assets.set(assetRow.asset_id, {
      asset_result: (assetRow.asset_result ?? 'not_reviewed') as AssetResult,
      comment: assetRow.comment,
      audio: assetRow.audio ?? [],
      source: assetRow.source
    });
  }

  return {
    id: row.id,
    questLabel: formatQuestDisplayLabel(row.questName, row.questMetadata),
    creatorName: row.username ?? '',
    date: row.concludedAt ?? row.lastUpdated,
    questResult: row.questResult as QuestResult | null,
    conclusion: row.conclusion,
    audio: row.audio?.length ? row.audio : getReviewAudio(row),
    assets
  };
}

export function useReviewResult(reviewId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['review-result', reviewId],
    queryFn: () => fetchReviewResult(reviewId)
  });
  return { result: data ?? null, isLoading };
}
