import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { quest, quest_tag_link, tag } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { createBibleChapterTags } from '@/utils/bibleTagUtils';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, isNull } from 'drizzle-orm';
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

        // Create chapter quest with proper parent_id
        console.log(
          `📖 Creating chapter quest: ${questName} (parent: ${bookQuestId})`
        );
        const [chapterQuest] = await tx
          .insert(resolveTable('quest', { localOverride: true }))
          .values({
            name: questName,
            description: `${verseCount} verses`,
            project_id: projectId,
            parent_id: bookQuestId, // Set parent to book quest
            creator_id: currentUser.id,
            download_profiles: [currentUser.id]
          })
          .returning();

        if (!chapterQuest) {
          throw new Error('Failed to create chapter quest');
        }

        // Link Bible tags for localization-proof identification
        // Note: All Bible book tags (66) and chapter tags (150) are pre-seeded globally
        // They should always exist in the database (synced from Supabase)
        const bibleTags = createBibleChapterTags(bookId, chapter);
        const questTagLinkLocal = resolveTable('quest_tag_link', {
          localOverride: true
        });

        // Find global book tag (should always exist)
        const [bookTag] = await tx
          .select()
          .from(tag)
          .where(
            and(
              eq(tag.key, bibleTags.book.key),
              eq(tag.value, bibleTags.book.value),
              isNull(tag.project_id) // Global Bible tags
            )
          )
          .limit(1);

        if (!bookTag) {
          console.warn(
            `⚠️  Bible book tag not found: ${bibleTags.book.value}. Skipping book tag link.`
          );
        } else {
          // Link book tag to quest (check for existing link to avoid duplicate key error)
          const existingBookLink = await tx
            .select()
            .from(quest_tag_link)
            .where(
              and(
                eq(quest_tag_link.quest_id, chapterQuest.id),
                eq(quest_tag_link.tag_id, bookTag.id)
              )
            )
            .limit(1);

          if (existingBookLink.length === 0) {
            await tx.insert(questTagLinkLocal).values({
              quest_id: chapterQuest.id,
              tag_id: bookTag.id,
              download_profiles: [currentUser.id]
            });
          }
        }

        // Find global chapter tag (should always exist)
        const [chapterTag] = await tx
          .select()
          .from(tag)
          .where(
            and(
              eq(tag.key, bibleTags.chapter.key),
              eq(tag.value, bibleTags.chapter.value),
              isNull(tag.project_id) // Global Bible tags
            )
          )
          .limit(1);

        if (!chapterTag) {
          console.warn(
            `⚠️  Bible chapter tag not found: ${bibleTags.chapter.value}. Skipping chapter tag link.`
          );
        } else {
          // Link chapter tag to quest (check for existing link to avoid duplicate key error)
          const existingChapterLink = await tx
            .select()
            .from(quest_tag_link)
            .where(
              and(
                eq(quest_tag_link.quest_id, chapterQuest.id),
                eq(quest_tag_link.tag_id, chapterTag.id)
              )
            )
            .limit(1);

          if (existingChapterLink.length === 0) {
            await tx.insert(questTagLinkLocal).values({
              quest_id: chapterQuest.id,
              tag_id: chapterTag.id,
              download_profiles: [currentUser.id]
            });
          }
        }

        console.log(
          `✅ Linked Bible tags: ${bibleTags.book.key}=${bibleTags.book.value}, ${bibleTags.chapter.key}=${bibleTags.chapter.value}`
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
    onSuccess: (result) => {
      // Invalidate the chapters query so UI updates (using bookId now)
      void queryClient.invalidateQueries({
        queryKey: ['bible-chapters', result.projectId, result.bookId]
      });

      // Also invalidate assets query for this quest
      void queryClient.invalidateQueries({
        queryKey: ['assets', 'infinite', 'by-quest', result.questId]
      });
    }
  });

  return {
    createChapter,
    isCreating: isPending
  };
}
