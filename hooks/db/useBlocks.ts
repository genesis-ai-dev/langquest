import { blocked_content, blocked_users } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { useHybridQuery } from '../useHybridQuery';

export type BlockedUser = InferSelectModel<typeof blocked_users>;
export type BlockedContent = InferSelectModel<typeof blocked_content>;

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
