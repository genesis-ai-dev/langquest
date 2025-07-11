import { vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridRealtimeQuery
} from '../useHybridQuery';

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
  } = useHybridRealtimeQuery({
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
    offlineQuery: toCompilableQuery(
      db.query.vote.findMany({
        where: and(
          eq(vote.translation_id, translation_id),
          eq(vote.creator_id, user_id),
          eq(vote.active, true)
        )
      })
    ),
    subscribeRealtime: (onChange) => {
      const channel = supabaseConnector.client
        .channel('public:vote')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vote' },
          onChange
        );
      channel.subscribe();
      return () => supabaseConnector.client.removeChannel(channel);
    },
    enabled: !!translation_id && !!user_id
  });

  const userVote = voteArray?.[0] || null;

  return { vote: userVote, isVoteLoading, ...rest };
}

function getVotesByTranslationIdConfig(translation_id: string) {
  return createHybridQueryConfig({
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
    offlineQuery: toCompilableQuery(
      system.db.query.vote.findMany({
        where: and(
          eq(vote.translation_id, translation_id),
          eq(vote.active, true)
        )
      })
    ),
    enabled: !!translation_id
  });
}

export function getVotesByTranslationId(translation_id: string) {
  return hybridFetch(
    convertToFetchConfig(getVotesByTranslationIdConfig(translation_id))
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
  } = useHybridRealtimeQuery({
    ...getVotesByTranslationIdConfig(translation_id),
    subscribeRealtime: (onChange) => {
      const channel = system.supabaseConnector.client
        .channel('public:vote')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vote' },
          onChange
        );
      channel.subscribe();
      return () => system.supabaseConnector.client.removeChannel(channel);
    }
  });

  return { votes, isVotesLoading, ...rest };
}
