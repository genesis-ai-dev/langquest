/**
 * Hook for creating FIA pericope-level quests.
 * Pericope quests are children of book quests, similar to Bible chapters.
 * Modeled on useBibleChapterCreation.
 */

import { useAuth } from '@/contexts/AuthContext';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFiaBookCreation } from './useFiaBookCreation';

interface CreatePericopeParams {
  projectId: string;
  bookId: string; // FIA book ID, e.g. "mrk"
  bookTitle: string; // Translated book title
  pericopeId: string; // FIA pericope ID, e.g. "mrk-p1"
  verseRange: string; // e.g. "1:1-13"
  totalPericopesInBook: number;
}

export function useFiaPericopeCreation() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { findOrCreateBook } = useFiaBookCreation();

  const { mutateAsync: createPericope, isPending } = useMutation({
    mutationFn: async (params: CreatePericopeParams) => {
      const {
        projectId,
        bookId,
        bookTitle,
        pericopeId,
        verseRange,
        totalPericopesInBook
      } = params;

      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      // Step 1: Ensure book quest exists
      const bookQuest = await findOrCreateBook({
        projectId,
        bookId,
        bookTitle,
        pericopeCount: totalPericopesInBook
      });

      return await system.db.transaction(async (tx) => {
        const questName = `${bookTitle} ${verseRange}`;

        const metadata: QuestMetadata = {
          fia: {
            bookId,
            pericopeId,
            verseRange
          }
        };

        const [pericopeQuest] = await tx
          .insert(resolveTable('quest', { localOverride: true }))
          .values({
            name: questName,
            description: verseRange,
            project_id: projectId,
            parent_id: bookQuest.id,
            creator_id: currentUser.id,
            download_profiles: [currentUser.id],
            metadata
          })
          .returning();

        if (!pericopeQuest) {
          throw new Error('Failed to create FIA pericope quest');
        }

        return {
          questId: pericopeQuest.id,
          questName: pericopeQuest.name,
          projectId,
          bookId
        };
      });
    },
    onSuccess: async (result) => {
      // Wait for PowerSync to sync
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await queryClient.invalidateQueries({
        queryKey: ['fia-pericope-quests', result.projectId, result.bookId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'for-project', result.projectId]
      });
    }
  });

  return {
    createPericope,
    isCreating: isPending
  };
}
