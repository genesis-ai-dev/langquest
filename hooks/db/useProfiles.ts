import { useAuth } from '@/contexts/AuthContext';
import { profile, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { useCallback } from 'react';

export type Profile = InferSelectModel<typeof profile>;
export type ProfileProjectLink = InferSelectModel<typeof profile_project_link>;

/**
 * Returns { profile, isLoading, error }
 * Fetches a profile by user ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useProfileByUserId(user_id: string) {
  const {
    data: profileArray,
    isLoading: isProfileLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['profile', user_id],
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile')
        .select('*')
        .eq('id', user_id)
        .overrideTypes<Profile[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.profile.findMany({
        where: eq(profile.id, user_id)
      })
    ),
    enabled: !!user_id
  });

  const userProfile = profileArray[0] || null;

  return { profile: userProfile, isProfileLoading, ...rest };
}

/**
 * Hook to get user memberships from local DB using PowerSync/TanStack Query
 * Replaces useSessionMemberships from SessionCacheContext
 */
export function useUserMemberships(userId?: string) {
  const { currentUser } = useAuth();
  const user_id = userId || currentUser?.id;

  const { data: membershipsData, isLoading } =
    useHybridQuery<ProfileProjectLink>({
      queryKey: ['user-memberships', user_id || ''],
      enabled: !!user_id, // Only query if user ID exists

      // PowerSync query using Drizzle - this will be reactive!
      offlineQuery: toCompilableQuery(
        system.db.query.profile_project_link.findMany({
          where: and(
            eq(profile_project_link.profile_id, user_id || ''),
            eq(profile_project_link.active, true)
          )
        })
      ),

      // Cloud query
      cloudQueryFn: async () => {
        // Guard: return empty array if no user ID (anonymous users)
        if (!user_id) return [];

        const { data, error } = await system.supabaseConnector.client
          .from('profile_project_link')
          .select('*')
          .eq('profile_id', user_id)
          .eq('active', true);

        if (error) throw error;
        return data as ProfileProjectLink[];
      }
    });

  // Ensure memberships is always an array
  const memberships = Array.isArray(membershipsData) ? membershipsData : [];

  const getUserMembership = useCallback(
    (projectId: string): ProfileProjectLink | undefined => {
      return memberships.find(
        (m: ProfileProjectLink) => m.project_id === projectId
      );
    },
    [memberships]
  );

  return {
    userMemberships: memberships,
    isUserMembershipsLoading: isLoading,
    getUserMembership
  };
}
