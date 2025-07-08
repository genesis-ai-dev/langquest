import { vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';

export const useVotesForTranslation = (translationId: string) => {
  const {
    data: votes = [],
    isLoading,
    error,
    ...rest
  } = useHybridQuery({
    queryKey: ['votes', translationId],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('vote')
        .select('*')
        .eq('translation_id', translationId);
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.vote.findMany({
        where: eq(vote.translation_id, translationId)
      })
    ),
    enabled: !!translationId
  });

  return {
    votes,
    isLoading,
    error,
    ...rest
  };
};
