import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';

interface CreateChapterParams {
    projectId: string;
    bookId: string;
    chapter: number;
    targetLanguageId: string;
}

export function useBibleChapterCreation() {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

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

            return await system.db.transaction(async (tx) => {
                const questName = `${book.name} ${chapter}`;

                // Check if quest already exists (race condition safeguard)
                const existingQuest = await tx
                    .select()
                    .from(resolveTable('quest', { localOverride: true }))
                    .where(
                        and(
                            eq(resolveTable('quest', { localOverride: true }).project_id, projectId),
                            eq(resolveTable('quest', { localOverride: true }).name, questName)
                        )
                    )
                    .limit(1);

                if (existingQuest.length > 0) {
                    console.log(`⚠️ Chapter already exists, returning existing quest: ${existingQuest[0].id}`);
                    return {
                        questId: existingQuest[0].id,
                        questName: existingQuest[0].name,
                        assetCount: 0,
                        projectId,
                        bookName: book.name
                    };
                }

                // Create just the chapter quest - assets will be created during recording
                const [chapterQuest] = await tx
                    .insert(resolveTable('quest', { localOverride: true }))
                    .values({
                        name: questName,
                        description: `${verseCount} verses`,
                        project_id: projectId,
                        parent_id: null, // For now, no book-level parent
                        creator_id: currentUser.id,
                        download_profiles: [currentUser.id]
                    })
                    .returning();

                if (!chapterQuest) {
                    throw new Error('Failed to create chapter quest');
                }

                console.log(`✅ Created chapter quest: ${chapterQuest.id}`);

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

