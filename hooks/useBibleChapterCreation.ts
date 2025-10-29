import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { quest } from '@/db/drizzleSchema';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';
import { useBibleBookCreation } from './useBibleBookCreation';

interface CreateChapterParams {
  projectId: string;
  bookId: string;
  chapter: number;
  targetLanguageId: string;
}

export function useBibleChapterCreation() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { findOrCreateBook } = useBibleBookCreation();

  const { mutateAsync: createChapter, isPending } = useMutation({
    mutationFn: async (params: CreateChapterParams) => {
      const { projectId, bookId, chapter, targetLanguageId } = params;

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

      // Step 1: Ensure book quest exists and get its ID
      const bookQuest = await findOrCreateBook({ projectId, bookId });
      const bookQuestId = bookQuest.id;

      return await system.db.transaction(async (tx) => {
        const questName = `${book.name} ${chapter}`;

        // Check if quest already exists in BOTH tables (more thorough)
        // This prevents creating duplicates if chapter was published
        const [existing] = await tx
          .select()
          .from(quest)
          .where(
            and(
              eq(quest.project_id, projectId),
              eq(quest.name, questName),
              eq(quest.parent_id, bookQuestId)
            )
          )
          .limit(1);

        if (existing) {
          console.log(`⚠️ Chapter already exists, returning: ${existing.id}`);
          return {
            questId: existing.id,
            questName: existing.name,
            assetCount: 0,
            projectId,
            bookId: bookId
          };
        }

        // Create chapter quest with proper parent_id and Bible metadata
        console.log(
          `📖 Creating chapter quest: ${questName} (parent: ${bookQuestId})`
        );

        // Create metadata for Bible chapter identification
        const metadata: QuestMetadata = {
          bible: {
            book: bookId,
            chapter: chapter
          }
        };

        const [chapterQuest] = await tx
          .insert(resolveTable('quest', { localOverride: true }))
          .values({
            name: questName,
            description: `${verseCount} verses`,
            project_id: projectId,
            parent_id: bookQuestId, // Set parent to book quest
            creator_id: currentUser.id,
            download_profiles: [currentUser.id],
            metadata: metadata // Store Bible book/chapter in metadata
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
          bookId: bookId // Return bookId instead of bookName
        };
      });
    },
    onSuccess: async (result) => {
      console.log('📥 [Create Chapter] Waiting for PowerSync to sync...');
      // Wait for PowerSync to sync the new chapter to local SQLite before invalidating
      // This ensures queries refetch with the new data, preserving loading states
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('📥 [Create Chapter] Invalidating queries...');
      // Invalidate the chapters query so UI updates (using bookId now)
      await queryClient.invalidateQueries({
        queryKey: ['bible-chapters', result.projectId, result.bookId]
      });

      // Invalidate all assets queries to refresh assets list
      await queryClient.invalidateQueries({
        queryKey: ['assets']
      });

      console.log('✅ [Create Chapter] All queries invalidated');
    }
  });

  return {
    createChapter,
    isCreating: isPending
  };
}
