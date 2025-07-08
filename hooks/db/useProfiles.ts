import { profile } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import {
  convertToSupabaseFetchConfig,
  createHybridSupabaseQueryConfig,
  hybridSupabaseFetch,
  useHybridSupabaseQuery
} from '../useHybridSupabaseQuery';

export type Profile = InferSelectModel<typeof profile>;

function getProfileByUserIdConfig(user_id: string) {
  return createHybridSupabaseQueryConfig({
    queryKey: ['profile', user_id],
    onlineFn: async ({ signal }) => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile')
        .select('*')
        .eq('id', user_id)
        .abortSignal(signal)
        .overrideTypes<Profile[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: system.db.query.profile.findMany({
      where: eq(profile.id, user_id)
    }),
    enabled: !!user_id
  });
}

export async function getProfileByUserId(user_id: string) {
  return (
    await hybridSupabaseFetch(
      convertToSupabaseFetchConfig(getProfileByUserIdConfig(user_id))
    )
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
  } = useHybridSupabaseQuery(getProfileByUserIdConfig(user_id));

  const userProfile = profileArray?.[0] || null;

  return { profile: userProfile, isProfileLoading, ...rest };
}
