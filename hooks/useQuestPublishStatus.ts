import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { isUnpublishedQuest } from '@/utils/dbUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';

export interface QuestPublishStatus {
  hasLocalCopy: boolean;
  hasSyncedCopy: boolean;
  isPublished: boolean;
}

/**
 * A quest is published when published_at is set.
 * Drafts (published_at null) are local-only from the reader's perspective.
 */
export function useQuestPublishStatus(
  questId: string | null | undefined
): QuestPublishStatus & { isLoading: boolean } {
  const { data, isLoading } = useHybridQuery<{
    id: string;
    published_at: string | Date | null;
  }>({
    queryKey: ['quest-publish-status', questId ?? ''],
    enabled: !!questId,
    offlineQuery: toCompilableQuery(
      system.db
        .select({ id: quest.id, published_at: quest.published_at })
        .from(quest)
        .where(eq(quest.id, questId ?? ''))
        .limit(1)
    ),
    cloudQueryFn: async () => {
      if (!questId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('id, published_at')
        .eq('id', questId)
        .limit(1);
      if (error) throw error;
      return data ?? [];
    }
  });

  const row = data[0];
  const unpublished = !row || isUnpublishedQuest(row);

  return {
    hasLocalCopy: unpublished,
    hasSyncedCopy: !unpublished,
    isPublished: !unpublished,
    isLoading
  };
}
