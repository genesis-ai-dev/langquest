import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import {
  allocateQuestVersionLabel,
  withQuestVersionLabel
} from '@/utils/questVersionLabel';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateChapterParams {
  projectId: string;
  bookId: string;
  chapter: number;
  targetLanguageId: string;
  parentQuestId: string;
}

export function useBibleChapterCreation() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync: createChapter, isPending } = useMutation({
    mutationFn: async (params: CreateChapterParams) => {
      const { projectId, bookId, chapter, targetLanguageId, parentQuestId } =
        params;

      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const book = getBibleBook(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const verseCount = book.verses[chapter - 1];
      if (!verseCount) {
        throw new Error(`Invalid chapter ${chapter} for book ${bookId}`);
      }

      console.log(
        `📖 Creating ${book.name} chapter ${chapter} with ${verseCount} verses...`
      );

      // The book quest is the route we are already on.
      const versionLabel = await allocateQuestVersionLabel(
        projectId,
        bookId,
        chapter
      );

      return await system.db.transaction(async (tx) => {
        const questName = `${book.name} ${chapter}`;

        const metadata: QuestMetadata = withQuestVersionLabel(
          {
            bible: {
              book: bookId,
              chapter: chapter
            },
            allowImportAssets: true
          },
          versionLabel
        );

        const [chapterQuest] = await tx
          .insert(resolveTable('quest', { localOverride: true }))
          .values({
            name: questName,
            description: `${verseCount} verses`,
            project_id: projectId,
            parent_id: parentQuestId,
            creator_id: currentUser.id,
            download_profiles: [currentUser.id],
            metadata: metadata,
            published_at: null
          })
          .returning();

        if (!chapterQuest) {
          throw new Error('Failed to create chapter quest');
        }

        console.log(
          `✅ Created chapter with metadata: book=${bookId}, chapter=${chapter}`
        );

        return {
          questId: chapterQuest.id,
          questName: chapterQuest.name,
          assetCount: 0, // No pre-created assets
          projectId,
          bookId: bookId, // Return bookId instead of bookName
          quest: chapterQuest
        };
      });
    },
    onSuccess: async (data) => {
      const queryKey = ['bible-chapters', 'offline', data.projectId];
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const rows = Array.isArray(old) ? old : [];
        if (rows.some((row: any) => row?.id === data.quest.id)) return rows;
        return [...rows, data.quest];
      });
    }
  });

  return {
    createChapter,
    isCreating: isPending
  };
}
