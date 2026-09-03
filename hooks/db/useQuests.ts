import { quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';

export type Quest = InferSelectModel<typeof questTable>;

export function useQuestById(quest_id: string | undefined) {
  const { db, supabaseConnector } = system;

  const {
    data: questArray,
    isLoading: isQuestLoading,
    ...rest
  } = useHybridData({
    dataType: 'quest',
    queryKeyParams: ['quest', quest_id],
    offlineQuery: toCompilableQuery(
      db.query.quest.findFirst({
        where: (fields, { eq }) => eq(fields.id, quest_id!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', quest_id)
        .limit(1)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    }
  });

  const quest = questArray[0] || null;

  return { quest, isQuestLoading, ...rest };
}
