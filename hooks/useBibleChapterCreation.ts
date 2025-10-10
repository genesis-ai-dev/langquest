import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
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
                const questLocal = resolveTable('quest', { localOverride: true });
                const questSynced = resolveTable('quest', { localOverride: false });

                // Check if quest already exists in BOTH tables (more thorough)
                // This prevents creating duplicates if chapter was published
                const [existingLocal] = await tx
                    .select()
                    .from(questLocal)
                    .where(
                        and(
                            eq(questLocal.project_id, projectId),
                            eq(questLocal.name, questName),
                            eq(questLocal.parent_id, bookQuestId)
                        )
                    )
                    .limit(1);

                if (existingLocal) {
                    console.log(`⚠️ Chapter already exists in local, returning: ${existingLocal.id}`);
                    return {
                        questId: existingLocal.id,
                        questName: existingLocal.name,
                        assetCount: 0,
                        projectId,
                        bookName: book.name
                    };
                }

                const [existingSynced] = await tx
                    .select()
                    .from(questSynced)
                    .where(
                        and(
                            eq(questSynced.project_id, projectId),
                            eq(questSynced.name, questName),
                            eq(questSynced.parent_id, bookQuestId)
                        )
                    )
                    .limit(1);

                if (existingSynced) {
                    console.log(`⚠️ Chapter already exists in synced, returning: ${existingSynced.id}`);
                    return {
                        questId: existingSynced.id,
                        questName: existingSynced.name,
                        assetCount: 0,
                        projectId,
                        bookName: book.name
                    };
                }

                // Create chapter quest with proper parent_id
                console.log(`📖 Creating chapter quest: ${questName} (parent: ${bookQuestId})`);
                const [chapterQuest] = await tx
                    .insert(questLocal)
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


                return {
                    questId: chapterQuest.id,
                    questName: chapterQuest.name,
                    assetCount: 0, // No pre-created assets
                    projectId,
                    bookName: book.name
                };
            });
        },
        onSuccess: (result) => {
            // Invalidate the chapters query so UI updates
            void queryClient.invalidateQueries({
                queryKey: ['bible-chapters', result.projectId, result.bookName]
            });

            // Also invalidate assets query for this quest
            void queryClient.invalidateQueries({
                queryKey: ['assets', 'infinite', result.questId]
            });
        }
    });

    return {
        createChapter,
        isCreating: isPending
    };
}

