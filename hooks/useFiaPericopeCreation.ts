/**
 * Hook for creating FIA pericope-level quests.
 * Pericope quests are children of book quests, similar to Bible chapters.
 * Modeled on useBibleChapterCreation.
 */

import { useAuth } from '@/contexts/AuthContext';
import { quest } from '@/db/drizzleSchema';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, sql } from 'drizzle-orm';
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

        // Check if pericope quest already exists via metadata
        const existing = await tx.run(
          sql.raw(`
            SELECT id, name, project_id
            FROM quest
            WHERE REPLACE(project_id, '-', '') = REPLACE('${projectId}', '-', '')
              AND json_extract(metadata, '$.fia.pericopeId') = '${pericopeId}'
            LIMIT 1
          `)
        );

        if (
          existing.rows?._array &&
          existing.rows._array.length > 0
        ) {
          const found = existing.rows._array[0] as {
            id: string;
            name: string;
          };
          return {
            questId: found.id,
            questName: found.name,
            projectId,
            bookId
          };
        }

        // Create pericope quest
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
