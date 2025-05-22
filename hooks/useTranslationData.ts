import { useSystem } from '@/contexts/SystemContext';
import { translation as translationTable } from '@/db/drizzleSchema';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';

export function useTranslationDataWithVotes(
  translationId: string,
  assetId?: string
) {
  const { db } = useSystem();

  const queryClient = useQueryClient();

  const dbQuery = db.query.translation.findFirst({
    where: eq(translationTable.id, translationId),
    with: {
      votes: true
    }
  });

  const initialData = queryClient.getQueryData<Awaited<typeof dbQuery>[]>([
    'translations',
    assetId
  ]);

  const {
    data: translations = [],
    isLoading: loadingTranslation,
    ...rest
  } = useQuery({
    queryKey: ['translation', translationId],
    query: toCompilableQuery(dbQuery),
    initialData: assetId
      ? [initialData?.find((data) => data?.id === translationId)]
      : undefined
  });

  const translation = translations[0];

  return { translation, loadingTranslation, ...rest };
}
