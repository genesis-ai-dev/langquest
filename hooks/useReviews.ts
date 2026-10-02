import type { ReviewOutcome, ReviewStatus } from '@/components/ReviewCard';
import { profile, quest, review } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import {
  REVIEW_STATUS_IN_PROGRESS,
  REVIEW_STATUS_SUBMITTED
} from '@/database_services/reviewService';
import { formatQuestDisplayLabel } from '@/utils/questVersionLabel';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import type { SQL } from 'drizzle-orm';
import { and, desc, eq, sql } from 'drizzle-orm';

export type ReviewTab = 'in-progress' | 'completed';

interface ReviewBase {
  id: string;
  questId: string;
  title: string;
  creatorName: string;
  date: string;
  origin: string;
}

export type Review = ReviewBase &
  (
    | { status: Extract<ReviewStatus, 'draft'> }
    | {
        status: Extract<ReviewStatus, 'published'>;
        outcome: ReviewOutcome;
      }
  );

export interface ReviewsFilter {
  projectId?: string;
  questId?: string;
  /** Matches reviews whose metadata contains every leaf value, e.g. { bible: { book: 'gen' } }. */
  metadata?: Record<string, unknown>;
}

type JsonLeaf = string | number | boolean;

function flattenMetadata(
  value: Record<string, unknown>,
  prefix = '$'
): [string, JsonLeaf][] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}.${key}`;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenMetadata(child as Record<string, unknown>, path);
    }
    if (
      typeof child === 'string' ||
      typeof child === 'number' ||
      typeof child === 'boolean'
    ) {
      return [[path, child] as [string, JsonLeaf]];
    }
    return [];
  });
}

function toOutcome(questResult: string | null): ReviewOutcome {
  return questResult === 'suggested_changes' ? 'suggested-changes' : 'approved';
}

export function useReviews(tab: ReviewTab, filter: ReviewsFilter) {
  const { projectId, questId, metadata } = filter;
  const metadataEntries = metadata ? flattenMetadata(metadata) : [];
  const isDraftTab = tab === 'in-progress';

  const conditions: SQL[] = [
    eq(review.project_id, projectId ?? ''),
    eq(review.active, true),
    eq(
      review.status,
      isDraftTab ? REVIEW_STATUS_IN_PROGRESS : REVIEW_STATUS_SUBMITTED
    )
  ];
  if (metadataEntries.length > 0) {
    for (const [path, value] of metadataEntries) {
      conditions.push(
        sql`json_extract(${review.metadata}, ${path}) = ${typeof value === 'boolean' ? Number(value) : value}`
      );
    }
  } else if (questId) {
    conditions.push(eq(review.quest_id, questId));
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      'reviews',
      tab,
      projectId,
      metadataEntries.length > 0 ? metadataEntries : questId
    ],
    enabled: !!projectId,
    query: toCompilableQuery(
      system.db
        .select({
          id: review.id,
          questId: review.quest_id,
          status: review.status,
          questResult: review.quest_result,
          origin: review.origin,
          concludedAt: review.concluded_at,
          lastUpdated: review.last_updated,
          questName: quest.name,
          questMetadata: quest.metadata,
          username: profile.username
        })
        .from(review)
        .leftJoin(quest, eq(quest.id, review.quest_id))
        .leftJoin(profile, eq(profile.id, review.profile_id))
        .where(and(...conditions))
        .orderBy(
          desc(sql`coalesce(${review.concluded_at}, ${review.last_updated})`)
        )
    )
  });

  const reviews: Review[] = (data ?? []).map((row) => {
    const base: ReviewBase = {
      id: row.id,
      questId: row.questId,
      title: formatQuestDisplayLabel(row.questName, row.questMetadata),
      creatorName: row.username ?? '',
      date: row.concludedAt ?? row.lastUpdated,
      origin: row.origin
    };
    return isDraftTab
      ? { ...base, status: 'draft' }
      : { ...base, status: 'published', outcome: toOutcome(row.questResult) };
  });

  return { reviews, isLoading };
}
