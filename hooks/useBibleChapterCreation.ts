import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import uuid from 'react-native-uuid';

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
                // 1. Create the chapter quest
                const [chapterQuest] = await tx
                    .insert(resolveTable('quest', { localOverride: true }))
                    .values({
                        name: `${book.name} ${chapter}`,
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

                console.log(`✅ Created quest: ${chapterQuest.id}`);

                // 2. Batch create all verse assets
                const assetValues = [];
                const questAssetLinks = [];

                for (let verse = 1; verse <= verseCount; verse++) {
                    const assetId = uuid.v4() as string;

                    assetValues.push({
                        id: assetId,
                        name: `${book.name} ${chapter}:${verse}`,
                        order_index: verse,
                        source_language_id: targetLanguageId,
                        project_id: projectId,
                        creator_id: currentUser.id,
                        download_profiles: [currentUser.id]
                    });

                    questAssetLinks.push({
                        id: `${chapterQuest.id}_${assetId}`,
                        quest_id: chapterQuest.id,
                        asset_id: assetId,
                        download_profiles: [currentUser.id]
                    });
                }

                // Batch insert all assets
                await tx
                    .insert(resolveTable('asset', { localOverride: true }))
                    .values(assetValues);

                // Batch insert all quest-asset links
                await tx
                    .insert(resolveTable('quest_asset_link', { localOverride: true }))
                    .values(questAssetLinks);

                console.log(
                    `✅ Created ${verseCount} verse assets for ${book.name} ${chapter}`
                );

                return {
                    questId: chapterQuest.id,
                    questName: chapterQuest.name,
                    assetCount: verseCount,
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

