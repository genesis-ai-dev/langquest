/**
 * Hook for creating or finding FIA book-level quests.
 * Book quests serve as parent containers for pericope quests.
 * Modeled on useBibleBookCreation.
 */

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
  bookId: string; // FIA book ID, e.g. "mrk"
  bookTitle: string; // Translated book title from FIA API
  pericopeCount: number;
}

interface BookQuest {
  id: string;
  name: string;
  project_id: string;
}

export function useFiaBookCreation() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync: findOrCreateBook, isPending } = useMutation({
    mutationFn: async (params: CreateBookParams): Promise<BookQuest> => {
      const { projectId, bookId, bookTitle, pericopeCount } = params;

      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      return await system.db.transaction(async (tx) => {
        // Check if book quest already exists via FIA metadata
        const booksWithMetadata = await tx.run(
          sql.raw(`
            SELECT id, name, project_id, metadata
            FROM quest
            WHERE REPLACE(project_id, '-', '') = REPLACE('${projectId}', '-', '')
              AND parent_id IS NULL
              AND json_extract(metadata, '$.fia.bookId') = '${bookId}'
            LIMIT 1
          `)
        );

        if (
          booksWithMetadata.rows?._array &&
          booksWithMetadata.rows._array.length > 0
        ) {
          const existing = booksWithMetadata.rows._array[0] as BookQuest;
          return {
            id: existing.id,
            name: existing.name,
            project_id: existing.project_id
          };
        }

        // Check Supabase cloud
        try {
          const { data: cloudBooks, error } =
            await system.supabaseConnector.client
              .from('quest')
              .select('id, name, project_id, metadata')
              .eq('project_id', projectId)
              .is('parent_id', null)
              .not('metadata', 'is', null);

          if (!error && cloudBooks) {
            for (const cloudBook of cloudBooks) {
              try {
                const meta =
                  typeof cloudBook.metadata === 'string'
                    ? JSON.parse(cloudBook.metadata)
                    : cloudBook.metadata;
                const parsed =
                  typeof meta === 'string' ? JSON.parse(meta) : meta;
                if (parsed?.fia?.bookId === bookId) {
                  return {
                    id: cloudBook.id as string,
                    name: cloudBook.name as string,
                    project_id: cloudBook.project_id as string
                  };
                }
              } catch {
                // skip malformed metadata
              }
            }
          }
        } catch (cloudError) {
          console.warn('Failed to check Supabase for FIA book:', cloudError);
        }

        // Create new book quest
        const metadata: QuestMetadata = {
          fia: { bookId }
        };

        const questLocal = resolveTable('quest', { localOverride: true });
        const [newBook] = await tx
          .insert(questLocal)
          .values({
            name: bookTitle,
            description: `${pericopeCount} pericopes`,
            project_id: projectId,
            parent_id: null,
            creator_id: currentUser.id,
            download_profiles: [currentUser.id],
            metadata
          })
          .returning();

        if (!newBook) {
          throw new Error('Failed to create FIA book quest');
        }

        return {
          id: newBook.id,
          name: newBook.name,
          project_id: newBook.project_id
        };
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ['fia-book-quests', result.project_id]
      });
    }
  });

  return {
    findOrCreateBook,
    isCreating: isPending
  };
}

/**
 * Hook to query existing FIA book quests for a project.
 * Filters by metadata.fia.bookId present and no pericopeId.
 */
export function useFiaBookQuests(projectId: string) {
  const offlineQueryBuilder = system.db
    .select()
    .from(quest)
    .where(
      and(
        eq(quest.project_id, projectId),
        isNull(quest.parent_id),
        sql`json_extract(json(${quest.metadata}), '$.fia.bookId') IS NOT NULL`,
        sql`json_extract(json(${quest.metadata}), '$.fia.pericopeId') IS NULL`
      )
    );

  const { data: books = [], ...rest } = useHybridData({
    dataType: 'fia-book-quests',
    queryKeyParams: [projectId],
    offlineQuery: toCompilableQuery(offlineQueryBuilder),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', projectId)
        .is('parent_id', null)
        .not('metadata', 'is', null)
        .overrideTypes<(typeof quest.$inferSelect)[]>();
      if (error) return [];
      // Filter for FIA books in JS (metadata is stored as JSON string)
      return data.filter((q) => {
        try {
          const meta =
            typeof q.metadata === 'string'
              ? JSON.parse(q.metadata)
              : q.metadata;
          const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
          return parsed?.fia?.bookId && !parsed?.fia?.pericopeId;
        } catch {
          return false;
        }
      });
    },
    enabled: !!projectId
  });

  return { books, ...rest };
}
