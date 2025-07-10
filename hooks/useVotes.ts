import { vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { eq } from 'drizzle-orm';
import { useHybridSupabaseQuery } from './useHybridSupabaseQuery';

export const useVotesForTranslation = (translationId: string) => {
  const {
    data: votes = [],
    isLoading,
    error,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['votes', translationId],
    query: system.db.query.vote.findMany({
      where: eq(vote.translation_id, translationId)
    }),
    enabled: !!translationId
  });

  return {
    votes,
    isLoading,
    error,
    ...rest
  };
};
