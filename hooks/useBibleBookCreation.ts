/**
 * Hook for creating or finding book-level quests
 * Book quests serve as parent containers for chapter quests
 */

import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { quest } from '@/db/drizzleSchema';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, isNull, sql } from 'drizzle-orm';

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
        // STRATEGY: Use metadata to find books, not quest names
        // Metadata is localization-proof and survives publishing/syncing

        console.log(
          `🔍 Looking for book "${bookName}" (${bookId}) in project ${projectId.substring(0, 8)}...`
        );

        // Query using JSON metadata - SQLite json_extract
        // Note: Using raw SQL for JSON operations since Drizzle doesn't have type-safe json_extract yet
        const booksWithMetadata = await tx.run(
          sql.raw(`
                        SELECT id, name, project_id, metadata
                        FROM quest
                        WHERE REPLACE(project_id, '-', '') = REPLACE('${projectId}', '-', '')
                          AND parent_id IS NULL
                          AND json_extract(metadata, '$.bible.book') = '${bookId}'
                        LIMIT 1
                    `)
        );

        if (
          booksWithMetadata.rows?._array &&
          booksWithMetadata.rows._array.length > 0
        ) {
          const existing = booksWithMetadata.rows._array[0] as BookQuest;
          console.log(
            `✅ Found book via metadata: ${existing.name} (${existing.id})`
          );
          return {
            id: existing.id,
            name: existing.name,
            project_id: existing.project_id
          };
        }

        // // FALLBACK: Try direct name-based query (for backward compatibility)
        // console.log(`🔄 Falling back to name-based search...`);
        // const [existing] = await tx
        //     .select()
        //     .from(quest)
        //     .where(
        //         and(
        //             eq(quest.project_id, projectId),
        //             eq(quest.name, bookName),
        //             isNull(quest.parent_id)
        //         )
        //     )
        // //     .limit(1);

        // if (existing) {
        //     console.log(
        //         `✅ Found existing book by name: ${existing.name} (${existing.id})`
        //     );
        //     return {
        //         id: existing.id,
        //         name: existing.name,
        //         project_id: existing.project_id
        //     };
        // }

        // console.log(`❌ No existing book found in local tables`);

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

        // Create metadata for Bible book identification
        const metadata: QuestMetadata = {
          bible: {
            book: bookId
            // Note: chapter is undefined for book-level quests
          }
        };

        const questLocal = resolveTable('quest', { localOverride: true });
        const [newBook] = await tx
          .insert(questLocal)
          .values({
            name: bookName,
            description: `${book.chapters} chapters`,
            project_id: projectId,
            parent_id: null, // Books have no parent
            creator_id: currentUser.id,
            download_profiles: [currentUser.id],
            metadata: metadata // Store Bible book in metadata
          })
          .returning();

        if (!newBook) {
          throw new Error('Failed to create book quest');
        }

        console.log(`✅ Created book quest with metadata: book=${bookId}`);

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
 * Fetches book quests from Supabase cloud using metadata field
 * Books have metadata.bible.book but no metadata.bible.chapter
 */
async function fetchCloudBooks(
  projectId: string
): Promise<(typeof quest.$inferSelect)[]> {
  console.log(
    `[fetchCloudBooks] Fetching from Supabase for projectId: ${projectId}`
  );

  try {
    // In Supabase, metadata is stored as a JSON string (not JSONB object)
    // So we can't use JSONB operators directly. Instead, fetch all quests and filter in JS
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_id', null)
      .not('metadata', 'is', null)
      .overrideTypes<
        {
          id: string;
          name: string;
          project_id: string;
          parent_id: string | null;
          metadata:
            | string
            | { bible?: { book: string; chapter?: number } }
            | null;
          [key: string]: unknown;
        }[]
      >();

    if (error) {
      console.error('[fetchCloudBooks] Supabase error:', error);
      return [];
    }

    if (data.length === 0) {
      console.log('[fetchCloudBooks] No quests found in cloud for project');
      return [];
    }

    // Parse metadata and filter for Bible books (have book but no chapter)
    const results: (typeof quest.$inferSelect)[] = [];
    for (const questItem of data) {
      if (!questItem.metadata) continue;

      try {
        // Handle double-encoded JSON (stored as string)
        let metadata: { bible?: { book: string; chapter?: number } };
        if (typeof questItem.metadata === 'string') {
          // Parse once to get the inner JSON string, then parse again to get the object
          const parsed: unknown = JSON.parse(questItem.metadata);
          metadata =
            typeof parsed === 'string'
              ? (JSON.parse(parsed) as {
                  bible?: { book: string; chapter?: number };
                })
              : (parsed as { bible?: { book: string; chapter?: number } });
        } else {
          metadata = questItem.metadata as {
            bible?: { book: string; chapter?: number };
          };
        }

        // Filter for Bible books: have bible.book but no bible.chapter
        if (metadata.bible?.book && metadata.bible.chapter === undefined) {
          results.push(questItem as typeof quest.$inferSelect);
        }
      } catch (e) {
        console.warn(`Failed to parse metadata for quest ${questItem.id}:`, e);
      }
    }

    console.log(
      `[fetchCloudBooks] Found ${results.length} cloud books out of ${data.length} quests`
    );
    return results;
  } catch (error) {
    console.error('[fetchCloudBooks] Exception:', error);
    return [];
  }
}

/**
 * Hook to query existing book quests for a project
 * Filters by metadata.bible.book and excludes quests with metadata.bible.chapter
 */
export function useBibleBooks(projectId: string) {
  const { data: books = [], ...rest } = useHybridData({
    dataType: 'bible-books',
    queryKeyParams: [projectId],
    offlineQuery: `
      SELECT *
      FROM quest
      WHERE project_id = '${projectId}'
        AND parent_id IS NULL
        AND json_extract(json(metadata), '$.bible.book') IS NOT NULL
        AND json_extract(json(metadata), '$.bible.chapter') IS NULL
    `,
    cloudQueryFn: () => fetchCloudBooks(projectId),
    transformCloudData: (cloudBook) => {
      // Parse metadata from string to object format to match offline data structure
      // This ensures book.metadata?.bible?.book works correctly
      let parsedMetadata: QuestMetadata | null = null;

      if (cloudBook.metadata) {
        try {
          let metadata: { bible?: { book: string; chapter?: number } };
          if (typeof cloudBook.metadata === 'string') {
            // Handle double-encoded JSON (stored as string)
            const parsed: unknown = JSON.parse(cloudBook.metadata);
            metadata =
              typeof parsed === 'string'
                ? (JSON.parse(parsed) as {
                    bible?: { book: string; chapter?: number };
                  })
                : (parsed as { bible?: { book: string; chapter?: number } });
          } else {
            metadata = cloudBook.metadata as {
              bible?: { book: string; chapter?: number };
            };
          }
          parsedMetadata = metadata as QuestMetadata;
        } catch (e) {
          console.warn(
            `Failed to parse metadata for cloud book ${cloudBook.id}:`,
            e
          );
        }
      }

      // Return book with parsed metadata in the same format as offline data
      return {
        ...cloudBook,
        metadata: parsedMetadata
      } as typeof quest.$inferSelect;
    },
    enabled: !!projectId
  });

  return {
    books,
    ...rest
  };
}
