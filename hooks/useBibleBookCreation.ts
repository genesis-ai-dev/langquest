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
                const questLocal = resolveTable('quest', { localOverride: true });
                const questSynced = resolveTable('quest', { localOverride: false });
                const tagLocal = resolveTable('tag', { localOverride: true });
                const tagSynced = resolveTable('tag', { localOverride: false });
                const questTagLinkLocal = resolveTable('quest_tag_link', { localOverride: true });
                const questTagLinkSynced = resolveTable('quest_tag_link', { localOverride: false });

                console.log(`🔍 Looking for book "${bookName}" (${bookId}) in project ${projectId.substring(0, 8)}...`);

                // Find book tag in both local and synced tables
                const bookTagLocal = await tx
                    .select()
                    .from(tagLocal)
                    .where(
                        and(
                            eq(tagLocal.key, BIBLE_TAG_KEYS.BOOK),
                            eq(tagLocal.value, bookId)
                        )
                    )
                    .limit(1);

                const bookTagSynced = await tx
                    .select()
                    .from(tagSynced)
                    .where(
                        and(
                            eq(tagSynced.key, BIBLE_TAG_KEYS.BOOK),
                            eq(tagSynced.value, bookId)
                        )
                    )
                    .limit(1);

                console.log(`🏷️  Book tag in LOCAL: ${bookTagLocal.length} found`);
                console.log(`🏷️  Book tag in SYNCED: ${bookTagSynced.length} found`);

                // Try to find quest via tag link (LOCAL first)
                if (bookTagLocal.length > 0 && bookTagLocal[0]) {
                    const tagLinks = await tx
                        .select()
                        .from(questTagLinkLocal)
                        .where(eq(questTagLinkLocal.tag_id, bookTagLocal[0].id));

                    console.log(`   Found ${tagLinks.length} quest-tag links in LOCAL`);

                    for (const link of tagLinks) {
                        const [quest] = await tx
                            .select()
                            .from(questLocal)
                            .where(
                                and(
                                    eq(questLocal.id, link.quest_id),
                                    eq(questLocal.project_id, projectId),
                                    isNull(questLocal.parent_id)
                                )
                            )
                            .limit(1);

                        if (quest) {
                            console.log(`✅ Found book via LOCAL tag: ${quest.name} (${quest.id})`);
                            return {
                                id: quest.id,
                                name: quest.name,
                                project_id: quest.project_id
                            };
                        }
                    }
                }

                // Try SYNCED tag
                if (bookTagSynced.length > 0 && bookTagSynced[0]) {
                    const tagLinks = await tx
                        .select()
                        .from(questTagLinkSynced)
                        .where(eq(questTagLinkSynced.tag_id, bookTagSynced[0].id));

                    console.log(`   Found ${tagLinks.length} quest-tag links in SYNCED`);

                    for (const link of tagLinks) {
                        const [quest] = await tx
                            .select()
                            .from(questSynced)
                            .where(
                                and(
                                    eq(questSynced.id, link.quest_id),
                                    eq(questSynced.project_id, projectId),
                                    isNull(questSynced.parent_id)
                                )
                            )
                            .limit(1);

                        if (quest) {
                            console.log(`✅ Found book via SYNCED tag: ${quest.name} (${quest.id})`);
                            return {
                                id: quest.id,
                                name: quest.name,
                                project_id: quest.project_id
                            };
                        }
                    }
                }

                // FALLBACK: Try direct name-based query (for backward compatibility)
                console.log(`🔄 Falling back to name-based search...`);
                const [existingLocal] = await tx
                    .select()
                    .from(questLocal)
                    .where(
                        and(
                            eq(questLocal.project_id, projectId),
                            eq(questLocal.name, bookName),
                            isNull(questLocal.parent_id)
                        )
                    )
                    .limit(1);

                if (existingLocal) {
                    console.log(`✅ Found existing book in local by name: ${existingLocal.name} (${existingLocal.id})`);
                    return {
                        id: existingLocal.id,
                        name: existingLocal.name,
                        project_id: existingLocal.project_id
                    };
                }

                const [existingSynced] = await tx
                    .select()
                    .from(questSynced)
                    .where(
                        and(
                            eq(questSynced.project_id, projectId),
                            eq(questSynced.name, bookName),
                            isNull(questSynced.parent_id)
                        )
                    )
                    .limit(1);

                if (existingSynced) {
                    console.log(`✅ Found existing book in synced by name: ${existingSynced.name} (${existingSynced.id})`);
                    return {
                        id: existingSynced.id,
                        name: existingSynced.name,
                        project_id: existingSynced.project_id
                    };
                }

                console.log(`❌ No existing book found in local tables`);

                // LAST RESORT: Check Supabase directly
                // This handles the case where the book was published but hasn't synced down yet
                console.log(`🌐 Checking Supabase for published book...`);
                try {
                    const { data: cloudBook, error: cloudError } = await system.supabaseConnector.client
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
                        console.log(`✅ Found book in Supabase cloud: ${cloudBook.name} (${cloudBook.id})`);
                        console.log(`   → Will use this ID (PowerSync will sync it down soon)`);
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
                // (tagLocal and questTagLinkLocal already declared at top of transaction)

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
                            name: `${BIBLE_TAG_KEYS.BOOK}:${bookId}`, // Derived from key:value for Supabase upload
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
                            isNull(questLocal.parent_id)
                        )
                    ),
                system.db
                    .select()
                    .from(questSynced)
                    .where(
                        and(
                            eq(questSynced.project_id, projectId),
                            isNull(questSynced.parent_id)
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


