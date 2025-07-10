import { quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { keepPreviousData } from '@tanstack/react-query';
import type { AnyColumn, InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq } from 'drizzle-orm';
import {
  convertToSupabaseFetchConfig,
  createHybridSupabaseQueryConfig,
  hybridSupabaseFetch,
  useHybridSupabaseInfiniteQuery,
  useHybridSupabaseQuery
} from '../useHybridSupabaseQuery';
import type { Tag } from './useTags';

export type Quest = InferSelectModel<typeof questTable>;

function getQuestsByProjectIdConfig(project_id: string) {
  return createHybridSupabaseQueryConfig({
    queryKey: ['quests', 'by-project', project_id],
    onlineFn: async ({ signal }) => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', project_id)
        .abortSignal(signal)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: system.db.query.quest.findMany({
      where: eq(questTable.project_id, project_id)
    }),
    enabled: !!project_id
  });
}

export function getQuestsByProjectId(project_id: string) {
  return hybridSupabaseFetch(
    convertToSupabaseFetchConfig(getQuestsByProjectIdConfig(project_id))
  );
}

/**
 * Returns { quests, isLoading, error }
 * Fetches quests by project ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useQuestsByProjectId(project_id: string) {
  const {
    data: quests,
    isLoading: isQuestsLoading,
    ...rest
  } = useHybridSupabaseQuery(getQuestsByProjectIdConfig(project_id));

  return { quests, isQuestsLoading, ...rest };
}

export function useQuestsWithTagsByProjectId(project_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: quests,
    isLoading: isQuestsLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['quests', 'by-project', 'with-tags', project_id],
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select(
          `
          *,
          tags:quest_tag_link (
            tag:tag_id (
              id,
              name,
              active,
              created_at,
              last_updated
            )
          )
        `
        )
        .eq('project_id', project_id)
        .abortSignal(signal)
        .overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.quest.findMany({
      where: eq(questTable.project_id, project_id),
      with: {
        tags: {
          with: {
            tag: true
          }
        }
      }
    }),
    enabled: !!project_id
  });

  return { quests, isQuestsLoading, ...rest };
}

/**
 * Returns { quest, isLoading, error }
 * Fetches a single quest by ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useQuestById(quest_id: string | undefined) {
  const { db, supabaseConnector } = system;

  // Main query using hybrid query
  const {
    data: questArray,
    isLoading: isQuestLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['quest', quest_id],
    enabled: !!quest_id,
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', quest_id)
        .limit(1)
        .abortSignal(signal)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.quest.findMany({
      where: (fields, { eq }) => eq(fields.id, quest_id!),
      limit: 1
    })
  });

  const quest = questArray?.[0] || null;

  return { quest, isQuestLoading, ...rest };
}

/**
 * Hybrid infinite query for quests with tags
 * Automatically switches between online and offline with proper caching
 * Follows TKDodo's best practices for infinite queries
 */
export function useInfiniteQuestsWithTagsByProjectId(
  project_id: string,
  pageSize = 10,
  sortField?: string,
  sortOrder?: 'asc' | 'desc'
) {
  return useHybridSupabaseInfiniteQuery({
    queryKey: [
      'quests',
      'by-project',
      'with-tags',
      project_id,
      sortField,
      sortOrder
    ].filter(Boolean),
    pageSize,
    onlineFn: async ({ pageParam, signal }) => {
      try {
        // Online query with proper pagination using Supabase range
        let query = system.supabaseConnector.client
          .from('quest')
          .select(
            `
            *,
            tags:quest_tag_link (
              tag:tag_id (
                id,
                name,
                active,
                created_at,
                last_updated
              )
            )
          `
          )
          .eq('project_id', project_id);

        // Add sorting if specified
        if (sortField && sortOrder) {
          query = query.order(sortField, { ascending: sortOrder === 'asc' });
        } else {
          // Default sort by quest name
          query = query.order('name', { ascending: true });
        }

        // Add pagination
        const from = pageParam * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        // Add abort signal for proper cleanup
        const { data, error } = await query
          .abortSignal(signal)
          .overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();

        if (error) {
          console.error(`[QuestsInfinite] Supabase error:`, error);
          throw error;
        }

        return data;
      } catch (error) {
        console.error(`[QuestsInfinite] ONLINE function error:`, error);
        throw error;
      }
    },
    offlineFn: async ({ pageParam }) => {
      // Offline query with manual pagination using Drizzle
      const offsetValue = pageParam * pageSize;

      try {
        const allQuests = await system.db.query.quest.findMany({
          where: eq(questTable.project_id, project_id),
          with: {
            tags: {
              with: {
                tag: true
              }
            }
          },
          limit: pageSize,
          offset: offsetValue,
          orderBy:
            sortField === 'name' && sortOrder
              ? sortOrder === 'asc'
                ? asc(questTable.name)
                : desc(questTable.name)
              : asc(questTable.name)
        });

        return allQuests;
      } catch (error) {
        console.error('[QuestsInfinite] Error in offline query:', error);
        // Return empty array rather than throwing
        return [];
      }
    },
    enabled: !!project_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes,
  });
}

/**
 * Traditional paginated quests with keepPreviousData for smooth page transitions
 * Use this when you need discrete page navigation (Previous/Next buttons)
 */
export function usePaginatedQuestsWithTagsByProjectId(
  project_id: string,
  page = 0,
  pageSize = 10,
  sortField?: string,
  sortOrder?: 'asc' | 'desc'
) {
  const { db, supabaseConnector } = system;

  return useHybridSupabaseQuery({
    queryKey: [
      'quests',
      'paginated',
      'by-project',
      'with-tags',
      project_id,
      page,
      pageSize,
      sortField,
      sortOrder
    ],
    onlineFn: async ({ signal }) => {
      let query = supabaseConnector.client
        .from('quest')
        .select(
          `
          *,
          tags:quest_tag_link (
            tag:tag_id (
              id,
              name,
              active,
              created_at,
              last_updated
            )
          )
        `,
          { count: 'exact' }
        )
        .eq('project_id', project_id);

      // Add sorting
      if (sortField && sortOrder) {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      // Add pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const {
        data,
        error,
        count: _count
      } = await query
        .abortSignal(signal)
        .overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();

      if (error) throw error;

      const quests = data;

      return quests;
    },
    offlineQuery: db.query.quest.findMany({
      where: eq(questTable.project_id, project_id),
      with: {
        tags: {
          with: {
            tag: true
          }
        }
      },
      limit: pageSize,
      offset: page * pageSize,
      orderBy:
        sortField && sortOrder
          ? sortOrder === 'asc'
            ? asc(questTable[sortField as keyof typeof questTable] as AnyColumn)
            : desc(
                questTable[sortField as keyof typeof questTable] as AnyColumn
              )
          : asc(questTable.name)
    }),
    enabled: !!project_id,
    placeholderData: keepPreviousData, // This provides smooth transitions between pages
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}
