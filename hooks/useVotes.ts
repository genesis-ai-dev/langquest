import { useSystem } from '@/contexts/SystemContext';
import { vote as voteTable } from '@/db/drizzleSchema';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { eq } from 'drizzle-orm';

export function useVotes(translationId: string) {
  const { db } = useSystem();

  const {
    data: votes,
    isLoading: loadingVotes,
    ...rest
  } = useQuery({
    queryKey: ['votes', translationId],
    query: toCompilableQuery(
      db.query.vote.findMany({
        where: eq(voteTable.translation_id, translationId)
      })
    )
  });

  return { votes, loadingVotes, ...rest };
}
