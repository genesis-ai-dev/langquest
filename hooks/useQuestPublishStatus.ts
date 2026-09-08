import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { isUnpublishedQuest } from '@/utils/dbUtils';
import { useQuery } from '@tanstack/react-query';
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

      const [row] = await system.db
        .select({ published_at: quest.published_at })
        .from(quest)
        .where(eq(quest.id, questId))
        .limit(1);

      const unpublished = !row || isUnpublishedQuest(row);

      return {
        hasLocalCopy: unpublished,
        hasSyncedCopy: !unpublished,
        isPublished: !unpublished
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
