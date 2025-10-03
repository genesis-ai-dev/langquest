import { asset } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import type { TranslationStatus } from '../types';

export interface TranslationStatusHook {
  data: TranslationStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useTranslationStatuses(assetId: string): TranslationStatusHook {
  const {
    data: translationData = [],
    refetch,
    isLoading,
    isError
  } = useHybridData({
    dataType: 'translation-settings',
    queryKeyParams: [assetId],
    offlineQuery: toCompilableQuery(
      system.db.query.asset.findMany({
        columns: {
          active: true,
          visible: true,
          creator_id: true
        },
        where: eq(asset.id, assetId)
      })
    ),
    cloudQueryFn: async (): Promise<(typeof asset.$inferSelect)[]> => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select('creator_id, active, visible')
        .eq('id', assetId)
        .limit(1);

      if (error) throw error;
      return data as (typeof asset.$inferSelect)[];
    }
  });

  return {
    data: translationData[0]
      ? {
          ...translationData[0],
          creator_id: translationData[0].creator_id!
        }
      : undefined,
    isLoading,
    isError,
    refetch
  };
}

export async function updateTranslationStatus(
  assetId: string,
  status: Partial<Pick<TranslationStatus, 'active' | 'visible'>>
) {
  const { db } = system;

  return await db
    .update(asset)
    .set({ ...status, last_updated: new Date().toISOString() })
    .where(eq(asset.id, assetId));
}
