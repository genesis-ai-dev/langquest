import { useAuth } from '@/contexts/AuthContext';
import type { QuestResult } from '@/database_services/reviewService';
import {
  getReviewAuthorName,
  isExternalReview
} from '@/database_services/reviewService';
import { notification, review } from '@/db/drizzleSchema';
import { notification_synced } from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { firstDate } from '@/utils/dateUtils';
import { formatQuestDisplayLabel } from '@/utils/questVersionLabel';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import { and, desc, eq } from 'drizzle-orm';

export const REVIEW_NOTIFICATION_TARGET = 'review';

export interface ReviewNotificationDetails {
  projectId: string;
  questId: string;
  questLabel: string;
  reviewerName: string;
  isExternal: boolean;
  questResult: QuestResult | null;
  date: string;
}

export interface ReviewNotification {
  id: string;
  reviewId: string;
  createdAt: string;
  /** Loaded from the server; null while offline or when the review is gone. */
  details: ReviewNotificationDetails | null;
}

interface CloudReviewRow {
  id: string;
  project_id: string;
  quest_id: string;
  origin: string;
  quest_result: string | null;
  metadata: string | null;
  concluded_at: string | null;
  created_at: string;
  quest: { name: string | null; metadata: unknown } | null;
  profile: { username: string | null } | null;
}

/** Unviewed review notifications. The rows sync locally, so this works offline. */
export function useUnviewedReviewNotifications() {
  const { currentUser, isAuthenticated } = useAuth();
  const userId = currentUser?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['review-notifications', userId],
    enabled: !!userId && isAuthenticated,
    query: toCompilableQuery(
      system.db
        .select({
          id: notification.id,
          reviewId: notification.target_record_id,
          createdAt: notification.created_at
        })
        .from(notification)
        .where(
          and(
            eq(notification.profile_id, userId ?? ''),
            eq(notification.target_table_name, REVIEW_NOTIFICATION_TARGET),
            eq(notification.viewed, false)
          )
        )
        .orderBy(desc(notification.created_at))
    )
  });

  return { notifications: data ?? [], isLoading };
}

// review rows only sync with downloaded quests, so details come from the server.
async function fetchReviewDetails(
  reviewIds: string[]
): Promise<Map<string, ReviewNotificationDetails>> {
  const { data, error } = await system.supabaseConnector.client
    .from('review')
    .select(
      'id, project_id, quest_id, origin, quest_result, metadata, concluded_at, created_at, quest:quest_id(name, metadata), profile:profile_id(username)'
    )
    .in('id', reviewIds);
  if (error) throw error;

  // PostgREST types embeds as arrays; both are many-to-one, so they are objects.
  const rows = data as unknown as CloudReviewRow[];
  return new Map(
    rows.map((row) => [
      row.id,
      {
        projectId: row.project_id,
        questId: row.quest_id,
        questLabel: formatQuestDisplayLabel(
          row.quest?.name,
          row.quest?.metadata
        ),
        reviewerName: getReviewAuthorName(
          row.origin,
          row.metadata,
          row.profile?.username
        ),
        isExternal: isExternalReview(row.origin),
        questResult: row.quest_result as QuestResult | null,
        date: firstDate(row.concluded_at, row.created_at)
      }
    ])
  );
}

export function useReviewNotifications() {
  const isOnline = useNetworkStatus();
  const { notifications, isLoading } = useUnviewedReviewNotifications();
  const reviewIds = notifications.map((item) => item.reviewId);

  const { data: details, isLoading: isLoadingDetails } = useTanstackQuery({
    queryKey: ['review-notification-details', reviewIds],
    queryFn: () => fetchReviewDetails(reviewIds),
    enabled: isOnline && reviewIds.length > 0,
    staleTime: 60000
  });

  const items: ReviewNotification[] = notifications.map((item) => ({
    id: item.id,
    reviewId: item.reviewId,
    createdAt: item.createdAt,
    details: details?.get(item.reviewId) ?? null
  }));

  return {
    notifications: items,
    isLoading:
      isLoading || (isOnline && reviewIds.length > 0 && isLoadingDetails)
  };
}

export async function markReviewNotificationViewed(notificationId: string) {
  await system.db
    .update(notification_synced)
    .set({ viewed: true, last_updated: new Date().toISOString() })
    .where(eq(notification_synced.id, notificationId));
}

/** True when the review row is on this device, so the result screen can open it. */
export async function isReviewAvailableLocally(reviewId: string) {
  const [row] = await system.db
    .select({ id: review.id })
    .from(review)
    .where(eq(review.id, reviewId))
    .limit(1);
  return !!row;
}
