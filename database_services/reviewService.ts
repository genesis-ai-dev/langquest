import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { review_asset_local, review_local } from '@/db/drizzleSchemaLocal';
import { system } from '@/db/powersync/system';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import { promoteLocalAudioValue } from '@/services/attachments/promoteLocalAudio';
import { and, eq, sql } from 'drizzle-orm';

export type ReviewRow = typeof review_local.$inferSelect;
export type ReviewAssetRow = typeof review_asset_local.$inferSelect;

export const REVIEW_STATUS_IN_PROGRESS = 'in_progress';
export const REVIEW_STATUS_SUBMITTED = 'submitted';

/** Book/chapter (Bible) or book/pericope (FIA) the reviewed quest refers to. */
export interface ReviewQuestScope {
  bible?: { book: string; chapter?: number };
  fia?: { bookId: string; pericopeId?: string; verseRange?: string };
}

export function getReviewQuestScope(questMetadata: unknown): ReviewQuestScope {
  let metadata: unknown = questMetadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  if (!metadata || typeof metadata !== 'object') return {};

  const { bible, fia } = metadata as Pick<QuestMetadata, 'bible' | 'fia'>;
  const scope: ReviewQuestScope = {};
  if (bible?.book) {
    scope.bible = { book: bible.book, chapter: bible.chapter };
  }
  if (fia?.bookId) {
    scope.fia = {
      bookId: fia.bookId,
      pericopeId: fia.pericopeId,
      verseRange: fia.verseRange
    };
  }
  return scope;
}

export type QuestResult = 'suggested_changes' | 'approved';
export type AssetResult = 'not_reviewed' | 'suggested_changes' | 'approved';

export interface ReviewAssetPatch {
  asset_result?: AssetResult;
  comment?: string | null;
  audio?: string[] | null;
}

export function getReviewLabel(metadata: unknown): string | null {
  let value = metadata;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const label = (value as { reviewLabel?: unknown }).reviewLabel;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}

export async function createDraftReview(data: {
  projectId: string;
  questId: string;
  profileId: string;
  origin: string;
  questScope: ReviewQuestScope;
  reviewLabel?: string;
}): Promise<string> {
  const reviewLabel = data.reviewLabel?.trim();
  const [created] = await system.db
    .insert(review_local)
    .values({
      project_id: data.projectId,
      quest_id: data.questId,
      profile_id: data.profileId,
      origin: data.origin,
      status: REVIEW_STATUS_IN_PROGRESS,
      metadata: {
        ...data.questScope,
        ...(reviewLabel ? { reviewLabel } : {})
      }
    })
    .returning({ id: review_local.id });

  if (!created) throw new Error('Failed to create review');
  return created.id;
}

export async function getReview(reviewId: string): Promise<ReviewRow | null> {
  const [row] = await system.db
    .select()
    .from(review_local)
    .where(eq(review_local.id, reviewId))
    .limit(1);
  return row ?? null;
}

export async function getDraftReviewForQuest(
  questId: string,
  profileId: string
): Promise<ReviewRow | null> {
  const [row] = await system.db
    .select()
    .from(review_local)
    .where(
      and(
        eq(review_local.quest_id, questId),
        eq(review_local.profile_id, profileId),
        eq(review_local.status, REVIEW_STATUS_IN_PROGRESS),
        eq(review_local.active, true)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getReviewAssets(
  reviewId: string
): Promise<ReviewAssetRow[]> {
  return system.db
    .select()
    .from(review_asset_local)
    .where(eq(review_asset_local.review_id, reviewId));
}

export async function updateReviewQuestResult(
  reviewId: string,
  questResult: QuestResult | null
) {
  await system.db
    .update(review_local)
    .set({ quest_result: questResult })
    .where(eq(review_local.id, reviewId));
}

export async function updateReviewConclusion(
  reviewId: string,
  conclusion: string | null
) {
  await system.db
    .update(review_local)
    .set({ conclusion })
    .where(eq(review_local.id, reviewId));
}

/** The review table has no audio column; overall feedback audio lives in metadata.audio. */
export function getReviewAudio(review: Pick<ReviewRow, 'metadata'>): string[] {
  const audio = (review.metadata as { audio?: unknown } | null)?.audio;
  return Array.isArray(audio)
    ? audio.filter((value): value is string => typeof value === 'string')
    : [];
}

export async function updateReviewLabel(
  reviewId: string,
  reviewLabel: string
) {
  const review = await getReview(reviewId);
  await system.db
    .update(review_local)
    .set({ metadata: { ...review?.metadata, reviewLabel } })
    .where(eq(review_local.id, reviewId));
}

export async function updateReviewAudio(reviewId: string, audio: string[]) {
  const review = await getReview(reviewId);
  await system.db
    .update(review_local)
    .set({ metadata: { ...review?.metadata, audio } })
    .where(eq(review_local.id, reviewId));
}

/** Concludes the review; once submitted it is no longer an editable draft. */
export async function submitReview(
  reviewId: string,
  questScope: ReviewQuestScope
) {
  const review = await getReview(reviewId);
  await system.db
    .update(review_local)
    .set({
      status: REVIEW_STATUS_SUBMITTED,
      concluded_at: new Date().toISOString(),
      metadata: { ...review?.metadata, ...questScope }
    })
    .where(eq(review_local.id, reviewId));
}

export async function reopenReviewDraft(reviewId: string) {
  await system.db
    .update(review_local)
    .set({ status: REVIEW_STATUS_IN_PROGRESS, concluded_at: null })
    .where(eq(review_local.id, reviewId));
}

function publishedAudioName(value: string) {
  return value.replace(/^local\//, '');
}

/**
 * Copies the local review into the syncing tables so PowerSync uploads it.
 * Audio filenames lose the local/ prefix, matching quest publish, and the
 * files are moved to the shared attachments folder for the uploader.
 */
export async function publishReview(reviewId: string) {
  if (!getNetworkStatus()) {
    throw new Error('OFFLINE');
  }

  const review = await getReview(reviewId);
  if (!review) throw new Error('Review not found');

  const assetRows = await getReviewAssets(reviewId);
  const overallAudio = getReviewAudio(review).map(publishedAudioName);
  const audioValues = [
    ...getReviewAudio(review),
    ...assetRows.flatMap((row) => row.audio ?? [])
  ];

  await system.db.transaction(async (tx) => {
    await tx.run(sql`
      INSERT OR IGNORE INTO review_synced (
        id, active, created_at, last_updated, source, _metadata,
        project_id, quest_id, profile_id, status, access_token, origin,
        external_id, quest_result, conclusion, metadata, concluded_at, audio
      )
      SELECT
        id, active, created_at, last_updated, source, _metadata,
        project_id, quest_id, profile_id, status, access_token, origin,
        external_id, quest_result, conclusion,
        REPLACE(metadata, 'local/', ''),
        concluded_at,
        ${JSON.stringify(overallAudio)}
      FROM review_local
      WHERE id = ${reviewId}
    `);

    await tx.run(sql`
      INSERT OR IGNORE INTO review_asset_synced (
        id, active, created_at, last_updated, source, _metadata,
        review_id, asset_id, asset_result, comment, audio, metadata
      )
      SELECT
        id, active, created_at, last_updated, source, _metadata,
        review_id, asset_id, asset_result, comment,
        REPLACE(IFNULL(audio, '[]'), 'local/', ''),
        metadata
      FROM review_asset_local
      WHERE review_id = ${reviewId}
    `);

    await Promise.all(
      audioValues.map((value) => promoteLocalAudioValue(value))
    );
  });

  system.audioUploader?.trigger();
}

export async function upsertReviewAsset(
  reviewId: string,
  assetId: string,
  patch: ReviewAssetPatch
) {
  const [existing] = await system.db
    .select({ id: review_asset_local.id })
    .from(review_asset_local)
    .where(
      and(
        eq(review_asset_local.review_id, reviewId),
        eq(review_asset_local.asset_id, assetId)
      )
    )
    .limit(1);

  if (existing) {
    await system.db
      .update(review_asset_local)
      .set(patch)
      .where(
        and(
          eq(review_asset_local.review_id, reviewId),
          eq(review_asset_local.asset_id, assetId)
        )
      );
    return;
  }

  await system.db.insert(review_asset_local).values({
    review_id: reviewId,
    asset_id: assetId,
    asset_result: patch.asset_result ?? 'not_reviewed',
    comment: patch.comment ?? null,
    audio: patch.audio ?? null
  });
}

/**
 * Asset ids marked as suggested changes that still have no comment and no
 * audio. Submission must be blocked while this list is not empty.
 */
export function findIncompleteSuggestedChanges(
  reviewAssets: Pick<
    ReviewAssetRow,
    'asset_id' | 'asset_result' | 'comment' | 'audio'
  >[]
): string[] {
  return reviewAssets
    .filter(
      (item) =>
        item.asset_result === 'suggested_changes' &&
        !item.comment?.trim() &&
        !item.audio?.length
    )
    .map((item) => item.asset_id);
}
