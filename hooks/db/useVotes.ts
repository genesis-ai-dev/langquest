import { vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import {
  convertToSupabaseFetchConfig,
  createHybridSupabaseQueryConfig,
  hybridSupabaseFetch,
  useHybridSupabaseRealtimeQuery
} from '../useHybridSupabaseQuery';

export type Vote = InferSelectModel<typeof vote>;

/**
 * Returns { vote, isLoading, error }
 * Fetches user's vote for a specific translation from Supabase (online) or local Drizzle DB (offline)
 */
export function useUserVoteForTranslation(
  translation_id: string,
  user_id: string
) {
  const { db, supabaseConnector } = system;

  const {
    data: voteArray,
    isLoading: isVoteLoading,
    ...rest
  } = useHybridSupabaseRealtimeQuery({
    queryKey: ['vote', 'user', translation_id, user_id],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('vote')
        .select('*')
        .eq('translation_id', translation_id)
        .eq('creator_id', user_id)
        .eq('active', true)
        .overrideTypes<Vote[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.vote.findMany({
      where: and(
        eq(vote.translation_id, translation_id),
        eq(vote.creator_id, user_id),
        eq(vote.active, true)
      )
    }),
    channelName: 'public:vote',
    subscriptionConfig: {
      table: 'vote',
      schema: 'public'
    },
    enabled: !!translation_id && !!user_id
  });

  const userVote = voteArray[0] || null;

  return { vote: userVote, isVoteLoading, ...rest };
}

function getVotesByTranslationIdConfig(translation_id: string) {
  return createHybridSupabaseQueryConfig({
    queryKey: ['votes', 'by-translation', translation_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('vote')
        .select('*')
        .eq('translation_id', translation_id)
        .eq('active', true)
        .overrideTypes<Vote[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: system.db.query.vote.findMany({
      where: and(eq(vote.translation_id, translation_id), eq(vote.active, true))
    }),
    enabled: !!translation_id
  });
}

export function getVotesByTranslationId(translation_id: string) {
  return hybridSupabaseFetch(
    convertToSupabaseFetchConfig(getVotesByTranslationIdConfig(translation_id))
  );
}

/**
 * Returns { votes, isLoading, error }
 * Fetches all votes for a specific translation from Supabase (online) or local Drizzle DB (offline)
 */
export function useVotesByTranslationId(translation_id: string) {
  const {
    data: votes,
    isLoading: isVotesLoading,
    ...rest
  } = useHybridSupabaseRealtimeQuery({
    ...getVotesByTranslationIdConfig(translation_id),
    channelName: 'public:vote',
    subscriptionConfig: {
      table: 'vote',
      schema: 'public'
    }
  });

  return { votes, isVotesLoading, ...rest };
}
