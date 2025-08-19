import { translation } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver/lib/src/utils/compilableQuery';
// import { useQueryClient } from '@tanstack/react-query/build/legacy/QueryClientProvider';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { eq } from 'drizzle-orm';
import type { TranslationStatus } from '../types';

export interface TranslationStatusHook {
  data: TranslationStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useTranslationStatuses(
  translationId: string
): TranslationStatusHook {
  const { db, supabaseConnector } = system;

  const {
    data: translationData = [],
    refetch,
    isLoading,
    isError
  } = useHybridQuery({
    queryKey: ['translation-settings', translationId],
    offlineQuery: toCompilableQuery(
      db.query.translation.findMany({
        columns: {
          active: true,
          visible: true,
          creator_id: true
        },
        where: eq(translation.id, translationId)
      })
    ),
    onlineFn: async (): Promise<(typeof translation.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('translation')
        .select('creator_id, active, visible')
        .eq('id', translationId)
        .limit(1);

      if (error) throw error;
      return data as (typeof translation.$inferSelect)[];
    }
  });

  return {
    data: translationData[0] || undefined,
    isLoading,
    isError,
    refetch
  };
}

export async function updateTranslationStatus(
  translationId: string,
  status: Partial<Pick<TranslationStatus, 'active' | 'visible'>>
) {
  const { db } = system;

  return await db
    .update(translation)
    .set({ ...status, last_updated: new Date().toISOString() })
    .where(eq(translation.id, translationId));
}
