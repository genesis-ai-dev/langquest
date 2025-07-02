import { project as projectTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc } from 'drizzle-orm';
import { useHybridInfiniteQuery, useHybridQuery } from '../useHybridQuery';

export type Project = InferSelectModel<typeof projectTable>;

/**
 * Returns { projects, isLoading, error }
 * Fetches projects from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjects() {
  const { db, supabaseConnector } = system;

  // Main query using hybrid realtime query
  const {
    data: projects,
    isLoading: isProjectsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['projects'],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('active', true)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: (fields, { eq, and }) => and(eq(fields.active, true))
      })
    )
  });

  return { projects, isProjectsLoading, ...rest };
}

/**
 * Hybrid infinite query for projects with pagination
 * Automatically switches between online and offline with proper caching
 * Follows TKDodo's best practices for infinite queries
 */
export function useInfiniteProjects(
  pageSize = 10,
  sortField?: 'name' | 'created_at' | 'last_updated',
  sortOrder?: 'asc' | 'desc'
) {
  const { db, supabaseConnector } = system;

  // Create clean query key without undefined values
  const queryKey = [
    'projects',
    'infinite',
    pageSize,
    ...(sortField ? [sortField] : []),
    ...(sortOrder ? [sortOrder] : [])
  ];

  return useHybridInfiniteQuery({
    queryKey,
    onlineFn: async ({ pageParam }) => {
      // Online query with proper pagination using Supabase range
      let query = supabaseConnector.client
        .from('project')
        .select('*', { count: 'exact' })
        .eq('visible', true)
        .eq('active', true);

      // Add sorting if specified
      if (sortField && sortOrder) {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      } else {
        // Default sort by name
        query = query.order('name', { ascending: true });
      }

      // Add pagination
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query.overrideTypes<Project[]>();

      if (error) throw error;

      const totalCount = count ?? 0;
      const hasMore = from + pageSize < totalCount;

      return {
        data,
        nextCursor: hasMore ? pageParam + 1 : undefined,
        hasMore,
        totalCount
      };
    },
    offlineFn: async ({ pageParam }) => {
      // Offline query with manual pagination using Drizzle
      const offsetValue = pageParam * pageSize;

      try {
        console.log(
          `[OfflineProjects] Loading page ${pageParam}, offset: ${offsetValue}`
        );

        const allProjects = await db.query.project.findMany({
          where: (fields, { eq, and }) =>
            and(eq(fields.visible, true), eq(fields.active, true)),
          limit: pageSize,
          offset: offsetValue,
          orderBy:
            sortField === 'name' && sortOrder
              ? sortOrder === 'asc'
                ? asc(projectTable.name)
                : desc(projectTable.name)
              : sortField === 'created_at' && sortOrder
                ? sortOrder === 'asc'
                  ? asc(projectTable.created_at)
                  : desc(projectTable.created_at)
                : sortField === 'last_updated' && sortOrder
                  ? sortOrder === 'asc'
                    ? asc(projectTable.last_updated)
                    : desc(projectTable.last_updated)
                  : asc(projectTable.name)
        });

        // Get total count for hasMore calculation
        const countQuery = await db.query.project.findMany({
          where: (fields, { eq, and }) =>
            and(eq(fields.visible, true), eq(fields.active, true))
        });

        const totalCount = countQuery.length;
        const hasMore = offsetValue + pageSize < totalCount;

        console.log(
          `[OfflineProjects] Found ${allProjects.length} projects, total: ${totalCount}, hasMore: ${hasMore}`
        );

        return {
          data: allProjects,
          nextCursor: hasMore ? pageParam + 1 : undefined,
          hasMore,
          totalCount
        };
      } catch (error) {
        console.error('[OfflineProjects] Error in offline query:', error);
        // Return empty result rather than throwing
        return {
          data: [],
          nextCursor: undefined,
          hasMore: false,
          totalCount: 0
        };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });
}

/**
 * Returns { project, isLoading, error }
 * Fetches a single project by ID from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjectById(projectId: string | undefined) {
  const { db, supabaseConnector } = system;

  // Main query using hybrid query
  const {
    data: projectArray,
    isLoading: isProjectLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId, // NOTE: only run the query if projectId is defined
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .eq('visible', true)
        .eq('active', true)
        .limit(1)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: (fields, { eq, and }) =>
          and(
            eq(fields.id, projectId!),
            eq(fields.visible, true),
            eq(fields.active, true)
          ),
        limit: 1
      })
    )
  });

  const project = projectArray?.[0] || null;

  return { project, isProjectLoading, ...rest };
}
