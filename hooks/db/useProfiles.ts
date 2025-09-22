import { useAuth } from '@/contexts/AuthContext';
import { profile, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { useCallback } from 'react';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery
} from '../useHybridQuery';

export type Profile = InferSelectModel<typeof profile>;
export type ProfileProjectLink = InferSelectModel<typeof profile_project_link>;

function getProfileByUserIdConfig(user_id: string) {
  return createHybridQueryConfig({
    queryKey: ['profile', user_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile')
        .select('*')
        .eq('id', user_id)
        .overrideTypes<Profile[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      system.db.query.profile.findMany({
        where: eq(profile.id, user_id)
      })
    ),
    enabled: !!user_id
  });
}

export async function getProfileByUserId(user_id: string) {
  return (
    await hybridFetch(convertToFetchConfig(getProfileByUserIdConfig(user_id)))
  )[0];
}

/**
 * Returns { profile, isLoading, error }
 * Fetches a profile by user ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useProfileByUserId(user_id: string) {
  const {
    data: profileArray,
    isLoading: isProfileLoading,
    ...rest
  } = useHybridQuery(getProfileByUserIdConfig(user_id));

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

  const { data: memberships, isLoading } = useHybridData<ProfileProjectLink>({
    dataType: 'user-memberships',
    queryKeyParams: [user_id || ''],

    // PowerSync query using Drizzle - this will be reactive!
    offlineQuery: toMergeCompilableQuery(
      system.db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, user_id || ''),
          eq(profile_project_link.active, true)
        )
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
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

/**
 * Hook to get user projects from local DB using PowerSync/TanStack Query
 * Replaces useSessionProjects from SessionCacheContext
 */
export function useUserProjects(userId?: string) {
  const { currentUser } = useAuth();
  const user_id = userId || currentUser?.id;

  const { data: projects = [], isLoading } = useHybridQuery({
    queryKey: ['user-projects', user_id],
    onlineFn: async () => {
      if (!user_id) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select(
          `
          *,
          profile_project_link!inner(
            profile_id,
            membership,
            active
          )
        `
        )
        .eq('profile_project_link.profile_id', user_id)
        .eq('profile_project_link.active', true);

      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      system.db.query.project.findMany({
        with: {
          profile_project_links: {
            where: and(
              eq(profile_project_link.profile_id, user_id || ''),
              eq(profile_project_link.active, true)
            )
          }
        }
      })
    ),
    enabled: !!user_id
  });

  // Filter projects to only include those where user has active membership
  const userProjects = projects.filter(
    (project) =>
      project.profile_project_link && project.profile_project_link.length > 0
  );

  return {
    userProjects,
    isUserProjectsLoading: isLoading
  };
}
