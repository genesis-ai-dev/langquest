import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver/lib/src/utils/compilableQuery';
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
    refetch,
    isLoading,
    isError
  } = useHybridQuery({
    queryKey: ['quest-settings', questId],
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
        columns: {
          active: true,
          visible: true
        },
        where: eq(quest.id, questId)
      })
    ),
    onlineFn: async (): Promise<(typeof quest.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('active, visible')
        .eq('id', questId)
        .limit(1);

      if (error) throw error;
      return data as (typeof quest.$inferSelect)[];
    }
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
