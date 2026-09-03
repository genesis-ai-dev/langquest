import { useAuth } from '@/contexts/AuthContext';
import { blocked_content, blocked_users } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';

export type ContentType = 'project' | 'quest' | 'asset' | 'asset_content_link';

export function useUserRestrictions(
  contentType: ContentType,
  includeBlockedContent = true,
  includeBlockedUsers = true,
  useOfflineData = false
) {
  const { db, supabaseConnector } = system;
  const { currentUser } = useAuth();

  // Always call hooks - use enabled flag to disable when no currentUser
  // This ensures hooks are called in the same order every render
  const {
    data: blockedContent,
    isLoading: isBlockedContentLoading,
    cloudError: blockedContentCloudError,
    offlineError: blockedContentOfflineError
    // refetch: refetchBlockedContent
  } = useHybridData<{ content_id: string }>({
    dataType: 'blocked_content',
    queryKeyParams: ['blocked_content', contentType, currentUser?.id || ''],

    // PowerSync query for votes
    offlineQuery:
      includeBlockedContent && currentUser
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
      if (!includeBlockedContent || !currentUser) return [];
      const { data, error } = await supabaseConnector.client
        .from('blocked_content')
        .select('content_id')
        .eq('profile_id', currentUser.id)
        .eq('content_table', contentType);

      if (error) throw error;
      return data as { content_id: string }[];
    },

    // Disable cloud query when user explicitly wants offline data or no currentUser
    enableCloudQuery: !useOfflineData && !!currentUser,
    enableOfflineQuery: !!currentUser,
    enabled: !!currentUser
  });

  const {
    data: blockedUsers,
    isLoading: isBlockedUsersLoading,
    cloudError: blockedUsersCloudError,
    offlineError: blockedUsersOfflineError
    // refetch: refetchBlockedUsers
  } = useHybridData<{ blocked_id: string }>({
    dataType: 'blocked_users',
    queryKeyParams: ['blocked_users', currentUser?.id || ''],

    // PowerSync query for votes
    offlineQuery:
      includeBlockedUsers && currentUser
        ? toCompilableQuery(
            db
              .select({ blocked_id: blocked_users.blocked_id })
              .from(blocked_users)
              .where(and(eq(blocked_users.blocker_id, currentUser.id)))
          )
        : 'SELECT blocked_id FROM blocked_users WHERE 1=0',
    // Cloud query for votes
    cloudQueryFn: async () => {
      if (!includeBlockedUsers || !currentUser) return [];
      const { data, error } = await supabaseConnector.client
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', currentUser.id);

      if (error) throw error;
      return data as { blocked_id: string }[];
    },

    // Disable cloud query when user explicitly wants offline data or no currentUser
    enableCloudQuery: !useOfflineData && !!currentUser,
    enableOfflineQuery: !!currentUser,
    enabled: !!currentUser
  });

  // const refetch = () => {
  //   void refetchBlockedContent();
  //   void refetchBlockedUsers();
  // };

  // Return early result if no currentUser (after hooks are called)
  if (!currentUser) {
    return {
      data: { blockedContentIds: [], blockedUserIds: [] },
      isRestrictionsLoading: false,
      hasError: false
    };
  }

  return {
    data: {
      blockedContentIds: blockedContent,
      blockedUserIds: blockedUsers
    },
    isRestrictionsLoading: isBlockedContentLoading || isBlockedUsersLoading,
    hasError: useOfflineData
      ? blockedContentOfflineError || blockedUsersOfflineError
      : blockedContentCloudError || blockedUsersCloudError
  };
}
