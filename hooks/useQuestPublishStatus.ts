import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';

export interface QuestPublishStatus {
  hasLocalCopy: boolean; // Indicates if local-only version exists
  hasSyncedCopy: boolean; // Indicates if published (synced) version exists
  isPublished: boolean; // Convenience flag: true if hasSyncedCopy
}

/**
 * Hook to check if a quest has been published
 * Returns publishing status by checking both local and synced quest tables
 *
 * A quest is considered "published" if it exists in the synced table (not just local-only)
 */
export function useQuestPublishStatus(
  questId: string | null | undefined
): QuestPublishStatus & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['quest-publish-status', questId],
    queryFn: async (): Promise<QuestPublishStatus> => {
      if (!questId) {
        return {
          hasLocalCopy: false,
          hasSyncedCopy: false,
          isPublished: false
        };
      }

      const results = await system.db
        .select()
        .from(quest)
        .where(eq(quest.id, questId));

      // Check which tables the quest exists in
      const hasLocal = results.some((q) => q.source === 'local');
      const hasSynced = results.some((q) => q.source === 'synced');

      return {
        hasLocalCopy: hasLocal,
        hasSyncedCopy: hasSynced,
        isPublished: hasSynced // Published means it exists in synced table
      };
    },
    enabled: !!questId
  });

  return {
    hasLocalCopy: data?.hasLocalCopy ?? false,
    hasSyncedCopy: data?.hasSyncedCopy ?? false,
    isPublished: data?.isPublished ?? false,
    isLoading
  };
}
