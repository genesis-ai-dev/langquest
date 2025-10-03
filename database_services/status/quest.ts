import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import type { LayerStatus } from '../types';

export interface QuestStatusHook {
  data: LayerStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useQuestStatuses(questId: string): QuestStatusHook {
  const { db, supabaseConnector } = system;

  const {
    data: questData = [],
    isLoading,
    isError,
    refetch
  } = useHybridData({
    dataType: 'quest-settings',
    queryKeyParams: [questId],
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
        columns: {
          active: true,
          visible: true
        },
        where: eq(quest.id, questId)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('active, visible')
        .eq('id', questId)
        .limit(1)
        .overrideTypes<
          Pick<typeof quest.$inferSelect, 'active' | 'visible'>[]
        >();

      if (error) throw error;
      return data;
    },
    enableOfflineQuery: !!questId,
    enableCloudQuery: !!questId,
    getItemId: () => questId
  });

  return {
    data: questData[0] || undefined,
    isLoading,
    isError,
    refetch
  };
}

export async function updateQuestStatus(
  questId: string,
  status: Partial<Pick<LayerStatus, 'active' | 'visible'>>
) {
  const { db } = system;

  return await db
    .update(quest)
    .set({ ...status, last_updated: new Date().toISOString() })
    .where(eq(quest.id, questId));
}
