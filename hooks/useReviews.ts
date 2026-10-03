import type { ReviewOutcome, ReviewStatus } from '@/components/ReviewCard';
import { profile, quest, review } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import {
  getReviewLabel,
  REVIEW_STATUS_IN_PROGRESS,
  REVIEW_STATUS_SUBMITTED
} from '@/database_services/reviewService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { formatQuestDisplayLabel } from '@/utils/questVersionLabel';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import type { SQL } from 'drizzle-orm';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export type ReviewTab = 'in-progress' | 'completed';

interface ReviewBase {
  id: string;
  questId: string;
  title: string;
  creatorName: string;
  date: string;
  origin: string;
  reviewLabel: string | null;
  /** Published in the cloud but its quest is not downloaded on this device. */
  needsDownload: boolean;
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

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function matchesMetadata(raw: unknown, entries: [string, JsonLeaf][]) {
  const parsed = parseJson(raw);
  return entries.every(([path, expected]) => {
    let node: unknown = parsed;
    for (const key of path.split('.').slice(1)) {
      if (!node || typeof node !== 'object') return false;
      node = (node as Record<string, unknown>)[key];
    }
    return node === expected;
  });
}

interface CloudReviewRow {
  id: string;
  quest_id: string;
  profile_id: string | null;
  quest_result: string | null;
  origin: string;
  concluded_at: string | null;
  created_at: string;
  metadata: string | null;
  quest: { name: string | null; metadata: unknown } | null;
}

async function fetchCloudReviews(
  projectId: string,
  questId: string | undefined,
  metadataEntries: [string, JsonLeaf][]
): Promise<Review[]> {
  let request = system.supabaseConnector.client
    .from('review')
    .select(
      'id, quest_id, profile_id, quest_result, origin, concluded_at, created_at, metadata, quest:quest_id(name, metadata)'
    )
    .eq('project_id', projectId)
    .eq('active', true)
    .eq('status', REVIEW_STATUS_SUBMITTED);
  // metadata is text server-side, so JSON matching happens client-side.
  if (metadataEntries.length === 0 && questId) {
    request = request.eq('quest_id', questId);
  }

  const { data, error } = await request;
  if (error) throw error;

  // PostgREST types embeds as arrays; quest_id is many-to-one, so it is an object.
  const rows = (data as unknown as CloudReviewRow[]).filter(
    (row) =>
      metadataEntries.length === 0 ||
      matchesMetadata(row.metadata, metadataEntries)
  );

  const profileIds = [
    ...new Set(rows.flatMap((row) => (row.profile_id ? [row.profile_id] : [])))
  ];
  const profiles =
    profileIds.length > 0
      ? await system.db.query.profile.findMany({
          where: inArray(profile.id, profileIds),
          columns: { id: true, username: true }
        })
      : [];
  const usernames = new Map(profiles.map((p) => [p.id, p.username ?? '']));

  return rows.map((row) => ({
    id: row.id,
    questId: row.quest_id,
    title: formatQuestDisplayLabel(row.quest?.name, row.quest?.metadata),
    creatorName: (row.profile_id && usernames.get(row.profile_id)) || '',
    date: row.concluded_at ?? row.created_at,
    origin: row.origin,
    reviewLabel: getReviewLabel(row.metadata),
    needsDownload: true,
    status: 'published',
    outcome: toOutcome(row.quest_result)
  }));
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
          metadata: review.metadata,
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

  const isOnline = useNetworkStatus();
  const { data: cloudReviews, isLoading: isLoadingCloud } = useTanstackQuery({
    queryKey: [
      'reviews',
      'cloud',
      projectId,
      metadataEntries.length > 0 ? metadataEntries : questId
    ],
    queryFn: () => fetchCloudReviews(projectId!, questId, metadataEntries),
    enabled: !!projectId && !isDraftTab && isOnline,
    staleTime: 60000
  });

  const localReviews: Review[] = (data ?? []).map((row) => {
    const base: ReviewBase = {
      id: row.id,
      questId: row.questId,
      title: formatQuestDisplayLabel(row.questName, row.questMetadata),
      creatorName: row.username ?? '',
      date: row.concludedAt ?? row.lastUpdated,
      origin: row.origin,
      reviewLabel: getReviewLabel(row.metadata),
      needsDownload: false
    };
    return isDraftTab
      ? { ...base, status: 'draft' }
      : { ...base, status: 'published', outcome: toOutcome(row.questResult) };
  });

  const localIds = new Set(localReviews.map((r) => r.id));
  const reviews = isDraftTab
    ? localReviews
    : [
        ...localReviews,
        ...(cloudReviews ?? []).filter((r) => !localIds.has(r.id))
      ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    reviews,
    isLoading: isLoading || (!isDraftTab && isOnline && isLoadingCloud)
  };
}
