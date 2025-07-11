import { profile } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery
} from '../useHybridQuery';

export type Profile = InferSelectModel<typeof profile>;

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
    offlineQuery: toCompilableQuery(
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
  )?.[0];
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

  const userProfile = profileArray?.[0] || null;

  return { profile: userProfile, isProfileLoading, ...rest };
}
