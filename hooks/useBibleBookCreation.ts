/**
 * Hook for creating or finding book-level quests
 * Book quests serve as parent containers for chapter quests
 */

import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { BIBLE_TAG_KEYS } from '@/utils/bibleTagUtils';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';
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
                // Check both local and synced tables for existing book quest
                // We need to check both because a book might have been published
                const questLocal = resolveTable('quest', { localOverride: true });
                const questSynced = resolveTable('quest', { localOverride: false });

                // First check local
                const [existingLocal] = await tx
                    .select()
                    .from(questLocal)
                    .where(
                        and(
                            eq(questLocal.project_id, projectId),
                            eq(questLocal.name, bookName),
                            eq(questLocal.parent_id, null) // Book has no parent
                        )
                    )
                    .limit(1);

                if (existingLocal) {
                    console.log(`📚 Found existing book in local: ${existingLocal.name} (${existingLocal.id})`);
                    return {
                        id: existingLocal.id,
                        name: existingLocal.name,
                        project_id: existingLocal.project_id
                    };
                }

                // Then check synced
                const [existingSynced] = await tx
                    .select()
                    .from(questSynced)
                    .where(
                        and(
                            eq(questSynced.project_id, projectId),
                            eq(questSynced.name, bookName),
                            eq(questSynced.parent_id, null) // Book has no parent
                        )
                    )
                    .limit(1);

                if (existingSynced) {
                    console.log(`📚 Found existing book in synced: ${existingSynced.name} (${existingSynced.id})`);
                    return {
                        id: existingSynced.id,
                        name: existingSynced.name,
                        project_id: existingSynced.project_id
                    };
                }

                // Book doesn't exist, create it in local
                console.log(`📚 Creating new book quest: ${bookName}`);
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
                const tagLocal = resolveTable('tag', { localOverride: true });
                const questTagLinkLocal = resolveTable('quest_tag_link', { localOverride: true });

                // Find or create book tag
                let [bookTag] = await tx
                    .select()
                    .from(tagLocal)
                    .where(
                        and(
                            eq(tagLocal.key, BIBLE_TAG_KEYS.BOOK),
                            eq(tagLocal.value, bookId)
                        )
                    )
                    .limit(1);

                if (!bookTag) {
                    [bookTag] = await tx
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
                    .from(questTagLinkLocal)
                    .where(
                        and(
                            eq(questTagLinkLocal.quest_id, newBook.id),
                            eq(questTagLinkLocal.tag_id, bookTag!.id)
                        )
                    )
                    .limit(1);

                if (existingLink.length === 0) {
                    await tx.insert(questTagLinkLocal).values({
                        id: String(uuid.v4()),
                        quest_id: newBook.id,
                        tag_id: bookTag!.id
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
    const { data: books = [], isLoading } = useQuery({
        queryKey: ['bible-books', projectId],
        queryFn: async () => {
            // Query for book-level quests (parent_id is null)
            const questLocal = resolveTable('quest', { localOverride: true });
            const questSynced = resolveTable('quest', { localOverride: false });

            // Get from both tables
            const [localBooks, syncedBooks] = await Promise.all([
                system.db
                    .select()
                    .from(questLocal)
                    .where(
                        and(
                            eq(questLocal.project_id, projectId),
                            eq(questLocal.parent_id, null)
                        )
                    ),
                system.db
                    .select()
                    .from(questSynced)
                    .where(
                        and(
                            eq(questSynced.project_id, projectId),
                            eq(questSynced.parent_id, null)
                        )
                    )
            ]);

            // Deduplicate by ID (prefer synced over local)
            const bookMap = new Map<string, BookQuest>();

            localBooks.forEach(book => {
                bookMap.set(book.id, {
                    id: book.id,
                    name: book.name,
                    project_id: book.project_id
                });
            });

            syncedBooks.forEach(book => {
                bookMap.set(book.id, {
                    id: book.id,
                    name: book.name,
                    project_id: book.project_id
                });
            });

            return Array.from(bookMap.values())
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        enabled: !!projectId
    });

    return {
        books,
        isLoading
    };
}


