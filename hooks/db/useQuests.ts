import { useAuth } from '@/contexts/AuthContext';
import { quest, quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { blockedContentQuery, blockedUsersQuery } from '@/utils/dbUtils';
import {
  useHybridData,
  useHybridPaginatedInfiniteData
} from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { keepPreviousData } from '@tanstack/react-query';
import type { AnyColumn, InferSelectModel } from 'drizzle-orm';
import { and, asc, desc, eq, like, notInArray, or } from 'drizzle-orm';
import { useMemo } from 'react';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridInfiniteQuery,
  useHybridQuery
} from '../useHybridQuery';
import { useUserRestrictions } from './useBlocks';
import type { Tag } from './useTags';

export type Quest = InferSelectModel<typeof questTable>;

function getQuestsByProjectIdConfig(project_id: string) {
  return createHybridQueryConfig({
    queryKey: ['quests', 'by-project', project_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', project_id)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findMany({
        where: eq(questTable.project_id, project_id)
      })
    ),
    enabled: !!project_id
  });
}

export function getQuestsByProjectId(project_id: string) {
  return hybridFetch(
    convertToFetchConfig(getQuestsByProjectIdConfig(project_id))
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
  } = useHybridQuery(getQuestsByProjectIdConfig(project_id));

  return { quests, isQuestsLoading, ...rest };
}

export function useQuestsWithTagsByProjectId(project_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: quests,
    isLoading: isQuestsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['quests', 'by-project', 'with-tags', project_id],
    onlineFn: async () => {
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
        .overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
        where: eq(questTable.project_id, project_id),
        with: {
          tags: {
            with: {
              tag: true
            }
          }
        }
      })
    ),
    enabled: !!project_id
  });

  return { quests, isQuestsLoading, ...rest };
}

export function useQuestById(quest_id: string | undefined) {
  const { db, supabaseConnector } = system;

  const {
    data: questArray,
    isLoading: isQuestLoading,
    ...rest
  } = useHybridData({
    dataType: 'quest',
    queryKeyParams: ['quest', quest_id],
    offlineQuery: toCompilableQuery(
      db.query.quest.findFirst({
        where: (fields, { eq }) => eq(fields.id, quest_id!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', quest_id)
        .limit(1)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    }
  });

  const quest = questArray[0] || null;

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
  // FIXED: Create stable query key with useMemo to prevent infinite loops
  const queryKey = useMemo(() => {
    const baseKey = [
      'quests',
      'infinite',
      'by-project',
      'with-tags',
      project_id,
      pageSize
    ];

    // Only add optional parameters if they have values
    if (sortField) baseKey.push(sortField);
    if (sortOrder) baseKey.push(sortOrder);

    return baseKey;
  }, [project_id, pageSize, sortField, sortOrder]);

  return useHybridInfiniteQuery({
    queryKey: queryKey,
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
          `,
            { count: 'exact' }
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
        const { data, error, count } = await query
          .abortSignal(signal)
          .overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();

        if (error) {
          console.error(`[QuestsInfinite] Supabase error:`, error);
          throw error;
        }

        const quests = data;
        const totalCount = count ?? 0;
        const hasMore = from + pageSize < totalCount;

        const result = {
          data: quests,
          nextCursor: hasMore ? pageParam + 1 : undefined,
          hasMore,
          totalCount
        };

        return result;
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

        // Get total count for hasMore calculation
        const totalQuests = await system.db.query.quest.findMany({
          where: eq(questTable.project_id, project_id),
          columns: { id: true }
        });

        const totalCount = totalQuests.length;
        const hasMore = offsetValue + pageSize < totalCount;

        const result = {
          data: allQuests,
          nextCursor: hasMore ? pageParam + 1 : undefined,
          hasMore,
          totalCount
        };

        return result;
      } catch (error) {
        console.error('[QuestsInfinite] Error in offline query:', error);
        // Return empty result rather than throwing
        const fallbackResult = {
          data: [],
          nextCursor: undefined,
          hasMore: false,
          totalCount: 0
        };
        return fallbackResult;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor;
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

  return useHybridQuery({
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
    onlineFn: async () => {
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
      } = await query.overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();

      if (error) throw error;

      const quests = data;

      return quests;
    },
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
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
              ? asc(
                  questTable[sortField as keyof typeof questTable] as AnyColumn
                )
              : desc(
                  questTable[sortField as keyof typeof questTable] as AnyColumn
                )
            : asc(questTable.name)
      })
    ),
    enabled: !!project_id,
    placeholderData: keepPreviousData, // This provides smooth transitions between pages
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

export function useInfiniteQuestsByProjectId(
  projectId: string | undefined,
  debouncedSearchQuery: string,
  showHiddenContent: boolean
) {
  const {
    data: restrictions,
    isRestrictionsLoading
    // hasError: hasRestrictionsError
  } = useUserRestrictions('quest', true, true, false);

  const blockContentIds = (restrictions.blockedContentIds ?? []).map(
    (c) => c.content_id
  );
  const blockUserIds = (restrictions.blockedUserIds ?? []).map(
    (c) => c.blocked_id
  );

  const { currentUser } = useAuth();

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isQuestsLoading,
    isOnline,
    isFetching
  } = useHybridPaginatedInfiniteData({
    dataType: 'quests',
    queryKeyParams: [projectId || '', debouncedSearchQuery],
    pageSize: 20,
    // Offline query - returns CompilableQuery
    offlineQuery: ({ page, pageSize: pageSizeParam }) => {
      const offset = page * pageSizeParam;

      // Build where conditions
      const baseCondition = eq(quest.project_id, projectId!);

      // Add search filtering for offline
      const whereConditions = and(
        baseCondition,
        debouncedSearchQuery.trim()
          ? or(
              like(quest.name, `%${debouncedSearchQuery}%`),
              like(quest.description, `%${debouncedSearchQuery}%`)
            )
          : undefined,
        or(
          !showHiddenContent ? eq(quest.visible, true) : undefined,
          eq(quest.creator_id, currentUser!.id)
        ),
        notInArray(quest.id, blockedContentQuery(currentUser!.id, 'quest')),
        notInArray(quest.creator_id, blockedUsersQuery(currentUser!.id))
      );

      return toCompilableQuery(
        system.db.query.quest.findMany({
          where: whereConditions,
          limit: pageSizeParam,
          offset
        })
      );
    },
    // Cloud query function
    cloudQueryFn: async ({ page, pageSize: pageSizeParam }) => {
      if (!projectId) return [];

      const from = page * pageSizeParam;
      const to = from + pageSizeParam - 1;

      let query = system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', projectId);

      if (!showHiddenContent) {
        query = query.eq('visible', true);
      }

      if (blockContentIds.length > 0) {
        query = query.not('id', 'in', `(${blockContentIds.join(',')})`);
      }

      if (blockUserIds.length > 0) {
        query = query.or(
          `creator_id.is.null,creator_id.not.in.(${blockUserIds.join(',')})`
        );
      }

      // Add search filtering
      if (debouncedSearchQuery.trim()) {
        query = query.or(
          `name.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`
        );
      }

      const { data, error } = await query
        .range(from, to)
        .overrideTypes<Quest[]>();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId
  });

  // Flatten pages data to match expected format
  const data = useMemo(() => {
    return infiniteData.pages.flatMap((page) => page.data);
  }, [infiniteData.pages]);

  const isLoading = isQuestsLoading || isRestrictionsLoading;

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching
  };
}
