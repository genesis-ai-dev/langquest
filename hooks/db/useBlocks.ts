import { useAuth } from '@/contexts/AuthContext';
import { blocked_content, blocked_users } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { useHybridQuery } from '../useHybridQuery';

export type BlockedUser = InferSelectModel<typeof blocked_users>;
export type BlockedContent = InferSelectModel<typeof blocked_content>;

export type ContentType = 'projects' | 'quests' | 'assets' | 'translations';

/**
 * Returns { blockedUsers, isLoading, error }
 * Fetches blocked users for a profile from Supabase (online) or local Drizzle DB (offline)
 */
export function useUserBlockedUsers(profile_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: blockedUsers,
    isLoading: isBlockedUsersLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['blocked-users', profile_id],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', profile_id)
        .overrideTypes<BlockedUser[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.blocked_users.findMany({
        where: eq(blocked_users.blocker_id, profile_id)
      })
    ),
    enabled: !!profile_id
  });

  return { blockedUsers, isBlockedUsersLoading, ...rest };
}

/**
 * Returns { blockedContent, isLoading, error }
 * Fetches blocked content for a profile from Supabase (online) or local Drizzle DB (offline)
 */
export function useUserBlockedContent(profile_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: blockedContent,
    isLoading: isBlockedContentLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['blocked-content', profile_id],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('blocked_content')
        .select('*')
        .eq('profile_id', profile_id)
        .overrideTypes<BlockedContent[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.blocked_content.findMany({
        where: eq(blocked_content.profile_id, profile_id)
      })
    ),
    enabled: !!profile_id
  });

  return { blockedContent, isBlockedContentLoading, ...rest };
}

export function useUserRestrictions(
  contentType: ContentType,
  includeBlockedContent = true,
  includeBlockedUsers = true,
  useOfflineData = false
) {
  const { db, supabaseConnector } = system;
  const { currentUser } = useAuth();

  if (!currentUser)
    return {
      data: { blockedContent: [], blockedUsers: [] },
      isRestrictionsLoading: false,
      hasError: false
    };

  const {
    data: blockedContent,
    isLoading: isBlockedContentLoading,
    cloudError: blockedContentCloudError,
    offlineError: blockedContentOfflineError,
    refetch: refetchBlockedContent
  } = useHybridData<{ content_id: string }>({
    dataType: 'blocked_content',
    queryKeyParams: ['blocked_content', contentType, currentUser.id],

    // PowerSync query for votes
    offlineQuery: includeBlockedContent
      ? toCompilableQuery(
          db
            .select({ content_id: blocked_content.content_id })
            .from(blocked_content)
            .where(
              and(
                eq(blocked_content.profile_id, currentUser.id),
                eq(blocked_content.content_table, contentType)
              )
            )
        )
      : 'SELECT content_id FROM blocked_content WHERE 1=0',
    // Cloud query for votes
    cloudQueryFn: async () => {
      if (!includeBlockedContent) return [];
      const { data, error } = await supabaseConnector.client
        .from('blocked_content')
        .select('content_id')
        .eq('profile_id', currentUser.id)
        .eq('content_table', contentType);

      if (error) throw error;
      return data as { content_id: string }[];
    },

    // Disable cloud query when user explicitly wants offline data
    enableCloudQuery: !useOfflineData
  });

  const {
    data: blockedUsers,
    isLoading: isBlockedUsersLoading,
    cloudError: blockedUsersCloudError,
    offlineError: blockedUsersOfflineError,
    refetch: refetchBlockedUsers
  } = useHybridData<{ blocked_id: string }>({
    dataType: 'blocked_users',
    queryKeyParams: ['blocked_users', currentUser.id],

    // PowerSync query for votes
    offlineQuery: includeBlockedUsers
      ? toCompilableQuery(
          db
            .select({ blocked_id: blocked_users.blocked_id })
            .from(blocked_users)
            .where(and(eq(blocked_users.blocker_id, currentUser.id)))
        )
      : 'SELECT blocked_id FROM blocked_users WHERE 1=0',
    // Cloud query for votes
    cloudQueryFn: async () => {
      if (!includeBlockedUsers) return [];
      const { data, error } = await supabaseConnector.client
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', currentUser.id);

      if (error) throw error;
      return data as { blocked_id: string }[];
    },

    // Disable cloud query when user explicitly wants offline data
    enableCloudQuery: !useOfflineData
  });

  const refetch = () => {
    void refetchBlockedContent();
    void refetchBlockedUsers();
  };

  return {
    data: {
      blockedContentIds: blockedContent,
      blockedUserIds: blockedUsers
    },
    isRestrictionsLoading: isBlockedContentLoading || isBlockedUsersLoading,
    hasError: useOfflineData
      ? blockedContentOfflineError || blockedUsersOfflineError
      : blockedContentCloudError || blockedUsersCloudError,
    refetch
  };
}
