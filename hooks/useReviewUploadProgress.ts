import {
  review_asset_synced,
  review_synced
} from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import type { QuestUploadProgress } from '@/hooks/useQuestUploadProgress';
import { eq, sql } from 'drizzle-orm';
import React from 'react';

interface ReviewCounts {
  total: number;
  confirmed: number;
  audio_total: number;
  audio_confirmed: number;
}

const EMPTY: QuestUploadProgress = {
  totalRecords: 0,
  confirmedRecords: 0,
  totalAudio: 0,
  confirmedAudio: 0,
  percent: 0,
  breakdown: {
    quest: { total: 0, confirmed: 0 },
    questAssetLinks: { total: 0, confirmed: 0 },
    assets: { total: 0, confirmed: 0 },
    contentLinks: { total: 0, confirmed: 0 },
    audio: { total: 0, confirmed: 0 }
  },
  isComplete: false,
  isPending: false,
  isEmpty: true
};

function toProgress(
  review: ReviewCounts | undefined,
  assets: ReviewCounts | undefined
): QuestUploadProgress {
  if (!review || !assets) return EMPTY;

  const totalRecords = review.total + assets.total;
  const confirmedRecords = review.confirmed + assets.confirmed;
  const totalAudio = review.audio_total + assets.audio_total;
  const confirmedAudio = review.audio_confirmed + assets.audio_confirmed;
  const total = totalRecords + totalAudio;
  const confirmed = confirmedRecords + confirmedAudio;

  if (total === 0) return EMPTY;

  const percent =
    confirmed >= total
      ? 100
      : Math.min(99, Math.round((confirmed / total) * 100));

  return {
    totalRecords,
    confirmedRecords,
    totalAudio,
    confirmedAudio,
    percent,
    breakdown: {
      ...EMPTY.breakdown,
      audio: { total: totalAudio, confirmed: confirmedAudio }
    },
    isComplete: confirmed >= total,
    isPending: confirmed < total,
    isEmpty: false
  };
}

/**
 * Live upload confirmation for a submitted review. Records are confirmed via
 * uploaded_at and audio via audio_uploaded_at, both stamped on the server and
 * synced back — the same signals the quest publish drawer watches.
 */
export function useReviewUploadProgress(
  reviewId: string | null
): QuestUploadProgress {
  const [progress, setProgress] = React.useState<QuestUploadProgress>(EMPTY);

  React.useEffect(() => {
    if (!reviewId) {
      setProgress(EMPTY);
      return;
    }

    const abortController = new AbortController();
    const reviewHasAudio = sql`${review_synced.audio} is not null and ${review_synced.audio} != '[]' and ${review_synced.audio} != '' and ${review_synced.audio} != 'null'`;
    const assetHasAudio = sql`${review_asset_synced.audio} is not null and ${review_asset_synced.audio} != '[]' and ${review_asset_synced.audio} != '' and ${review_asset_synced.audio} != 'null'`;

    const reviewCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${review_synced.uploaded_at} is not null)`,
        audio_total: sql<number>`count(*) filter (where ${reviewHasAudio})`,
        audio_confirmed: sql<number>`count(*) filter (where ${reviewHasAudio} and ${review_synced.audio_uploaded_at} is not null)`
      })
      .from(review_synced)
      .where(eq(review_synced.id, reviewId));

    const assetCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${review_asset_synced.uploaded_at} is not null)`,
        audio_total: sql<number>`count(*) filter (where ${assetHasAudio})`,
        audio_confirmed: sql<number>`count(*) filter (where ${assetHasAudio} and ${review_asset_synced.audio_uploaded_at} is not null)`
      })
      .from(review_asset_synced)
      .where(eq(review_asset_synced.review_id, reviewId));

    const rows: { review?: ReviewCounts; assets?: ReviewCounts } = {};
    const publish = () => {
      if (abortController.signal.aborted) return;
      if (!rows.review || !rows.assets) return;
      setProgress(toProgress(rows.review, rows.assets));
    };

    const watch = (
      query: Parameters<typeof system.db.watch<ReviewCounts>>[0],
      assign: (row: ReviewCounts | undefined) => void
    ) => {
      system.db.watch<ReviewCounts>(
        query,
        {
          onResult: (results) => {
            assign(results[0]);
            publish();
          },
          onError: (err) => {
            if (abortController.signal.aborted) return;
            console.error('Review upload progress watch error:', err);
          }
        },
        { signal: abortController.signal }
      );
    };

    watch(reviewCounts, (row) => (rows.review = row));
    watch(assetCounts, (row) => (rows.assets = row));

    return () => {
      abortController.abort();
    };
  }, [reviewId]);

  return progress;
}
