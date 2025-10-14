/**
 * Hook for creating or finding book-level quests
 * Book quests serve as parent containers for chapter quests
 */

import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { quest, quest_tag_link, tag } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { BIBLE_TAG_KEYS } from '@/utils/bibleTagUtils';
import { resolveTable } from '@/utils/dbUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, isNull } from 'drizzle-orm';
import uuid from 'react-native-uuid';

interface CreateBookParams {
    projectId: string;
    bookId: string;
}

interface BookQuest {
    id: string;
    name: string;
    project_id: string;
}

/**
 * Hook to get or create a book-level quest
 * Books are parent containers for chapters in the Bible template
 */
export function useBibleBookCreation() {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    /**
     * Find existing book quest or create it if it doesn't exist
     */
    const { mutateAsync: findOrCreateBook, isPending } = useMutation({
        mutationFn: async (params: CreateBookParams): Promise<BookQuest> => {
            const { projectId, bookId } = params;

            if (!currentUser?.id) {
                throw new Error('User not authenticated');
            }

            const book = getBibleBook(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            const bookName = book.name;

            return await system.db.transaction(async (tx) => {
                // STRATEGY: Use Bible tags to find books, not quest names
                // Tags are localization-proof and survive publishing/syncing

                console.log(
                    `🔍 Looking for book "${bookName}" (${bookId}) in project ${projectId.substring(0, 8)}...`
                );

                // Find book tag
                const bookTag = await tx
                    .select()
                    .from(tag)
                    .where(and(eq(tag.key, BIBLE_TAG_KEYS.BOOK), eq(tag.value, bookId)))
                    .limit(1);

                console.log(`🏷️  Book tag found: ${bookTag.length}`);

                // Try to find quest via tag link
                if (bookTag.length > 0 && bookTag[0]) {
                    const tagLinks = await tx
                        .select()
                        .from(quest_tag_link)
                        .where(eq(quest_tag_link.tag_id, bookTag[0].id));

                    console.log(`   Found ${tagLinks.length} quest-tag links`);

                    for (const link of tagLinks) {
                        const [existing] = await tx
                            .select()
                            .from(quest)
                            .where(
                                and(
                                    eq(quest.id, link.quest_id),
                                    eq(quest.project_id, projectId),
                                    isNull(quest.parent_id)
                                )
                            )
                            .limit(1);

                        if (existing) {
                            console.log(
                                `✅ Found book via tag: ${existing.name} (${existing.id})`
                            );
                            return {
                                id: existing.id,
                                name: existing.name,
                                project_id: existing.project_id
                            };
                        }
                    }
                }

                // FALLBACK: Try direct name-based query (for backward compatibility)
                console.log(`🔄 Falling back to name-based search...`);
                const [existing] = await tx
                    .select()
                    .from(quest)
                    .where(
                        and(
                            eq(quest.project_id, projectId),
                            eq(quest.name, bookName),
                            isNull(quest.parent_id)
                        )
                    )
                    .limit(1);

                if (existing) {
                    console.log(
                        `✅ Found existing book by name: ${existing.name} (${existing.id})`
                    );
                    return {
                        id: existing.id,
                        name: existing.name,
                        project_id: existing.project_id
                    };
                }

                console.log(`❌ No existing book found in local tables`);

                // LAST RESORT: Check Supabase directly
                // This handles the case where the book was published but hasn't synced down yet
                console.log(`🌐 Checking Supabase for published book...`);
                try {
                    const { data: cloudBook, error: cloudError } =
                        await system.supabaseConnector.client
                            .from('quest')
                            .select('id, name, project_id')
                            .eq('project_id', projectId)
                            .eq('name', bookName)
                            .is('parent_id', null)
                            .limit(1)
                            .maybeSingle();

                    if (cloudError && cloudError.code !== 'PGRST116') {
                        console.warn('⚠️  Error checking Supabase:', cloudError);
                    }

                    if (cloudBook) {
                        console.log(
                            `✅ Found book in Supabase cloud: ${cloudBook.name} (${cloudBook.id})`
                        );
                        console.log(
                            `   → Will use this ID (PowerSync will sync it down soon)`
                        );
                        return {
                            id: cloudBook.id as string,
                            name: cloudBook.name as string,
                            project_id: cloudBook.project_id as string
                        };
                    }
                } catch (cloudCheckError) {
                    console.warn('⚠️  Failed to check Supabase:', cloudCheckError);
                    // Continue to create new book
                }

                console.log(`❌ Book not found anywhere - creating new one`);

                // Book doesn't exist anywhere, create it in local
                console.log(`📚 Creating new book quest: ${bookName}`);
                const questLocal = resolveTable('quest', { localOverride: true });
                const [newBook] = await tx
                    .insert(questLocal)
                    .values({
                        name: bookName,
                        description: `${book.chapters} chapters`,
                        project_id: projectId,
                        parent_id: null, // Books have no parent
                        creator_id: currentUser.id,
                        download_profiles: [currentUser.id]
                    })
                    .returning();

                if (!newBook) {
                    throw new Error('Failed to create book quest');
                }

                // Create Bible tag for localization-proof identification

                // Find or create book tag
                let [newBookTag] = await tx
                    .select()
                    .from(tag)
                    .where(and(eq(tag.key, BIBLE_TAG_KEYS.BOOK), eq(tag.value, bookId)))
                    .limit(1);

                if (!newBookTag) {
                    const tagLocal = resolveTable('tag', { localOverride: true });
                    [newBookTag] = await tx
                        .insert(tagLocal)
                        .values({
                            key: BIBLE_TAG_KEYS.BOOK,
                            value: bookId,
                            download_profiles: [currentUser.id]
                        })
                        .returning();
                }

                // Link book tag to quest (with primary key check)
                const existingLink = await tx
                    .select()
                    .from(quest_tag_link)
                    .where(
                        and(
                            eq(quest_tag_link.quest_id, newBook.id),
                            eq(quest_tag_link.tag_id, newBookTag!.id)
                        )
                    )
                    .limit(1);

                if (existingLink.length === 0) {
                    const questTagLinkLocal = resolveTable('quest_tag_link', {
                        localOverride: true
                    });
                    await tx.insert(questTagLinkLocal).values({
                        id: String(uuid.v4()),
                        quest_id: newBook.id,
                        tag_id: newBookTag!.id
                    });
                }

                console.log(`✅ Created book quest with Bible tag: ${bookId}`);

                return {
                    id: newBook.id,
                    name: newBook.name,
                    project_id: newBook.project_id
                };
            });
        },
        onSuccess: (result) => {
            // Invalidate queries to update UI
            void queryClient.invalidateQueries({
                queryKey: ['bible-books', result.project_id]
            });
        }
    });

    return {
        findOrCreateBook,
        isCreating: isPending
    };
}

/**
 * Hook to query existing book quests for a project
 */
export function useBibleBooks(projectId: string) {
    const { data: books = [], ...rest } = useHybridData({
        dataType: 'bible-books',
        queryKeyParams: [projectId],
        offlineQuery: toCompilableQuery(
            system.db
                .select()
                .from(quest)
                .where(and(eq(quest.project_id, projectId), isNull(quest.parent_id)))
        ),
        enabled: !!projectId
    });

    return {
        books,
        ...rest
    };
}
