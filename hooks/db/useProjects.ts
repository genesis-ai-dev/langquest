import { project as projectTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { SortOrder } from '@/utils/dbUtils';
import { sortingHelper, toMergeCompilableQuery } from '@/utils/dbUtils';
import { getOptionShowHiddenContent } from '@/utils/settingsUtils';
import {
  useHybridData,
  useSimpleHybridInfiniteData
} from '@/views/new/useHybridData';
import type { InferSelectModel } from 'drizzle-orm';
import { useMemo } from 'react';

export type Project = InferSelectModel<typeof projectTable>;

/**
 * Returns { projects, isLoading, error }
 * Fetches projects from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjects() {
  const { db, supabaseConnector } = system;

  const {
    data: projects,
    isLoading: isProjectsLoading,
    ...rest
  } = useHybridData({
    dataType: 'projects',
    queryKeyParams: [],
    offlineQuery: toMergeCompilableQuery(
      db.query.project.findMany({
        where: (fields, { eq, and }) => and(eq(fields.active, true))
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('active', true)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    }
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
  sortField?: keyof (typeof projectTable)['_']['columns'],
  sortOrder?: SortOrder
) {
  const { db, supabaseConnector } = system;

  // Create stable query key parts
  const queryParams = useMemo(() => {
    return [pageSize, sortField ?? '', sortOrder ?? ''];
  }, [pageSize, sortField, sortOrder]);

  return useSimpleHybridInfiniteData<Project>(
    'projects',
    queryParams,
    // Offline query function
    async ({ pageParam, pageSize }) => {
      const offsetValue = pageParam * pageSize;

      const allProjects = await db.query.project.findMany({
        where: (fields, { eq, and }) =>
          and(eq(fields.visible, true), eq(fields.active, true)),
        limit: pageSize,
        offset: offsetValue,
        ...(sortField &&
          sortOrder && {
            orderBy: sortingHelper(projectTable, sortField, sortOrder)
          })
      });

      return allProjects;
    },
    // Cloud query function
    async ({ pageParam, pageSize }) => {
      const showInvisible = await getOptionShowHiddenContent();

      let query = supabaseConnector.client.from('project').select('*');

      if (!showInvisible) {
        query = query.eq('visible', true);
      }

      if (sortField && sortOrder) {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const from = pageParam * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query.overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    pageSize
  );
}

/**
 * Returns { project, isLoading, error }
 * Fetches a single project by ID from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjectById(projectId: string | undefined) {
  const { db, supabaseConnector } = system;

  const hybrid = useHybridData({
    dataType: 'project',
    queryKeyParams: [projectId || ''],
    offlineQuery: toMergeCompilableQuery(
      db.query.project.findFirst({
        where: (fields, { eq, and }) =>
          and(
            eq(fields.id, projectId!)
            // keep visibility/active unconstrained per original comment
          )
      })
    ),
    cloudQueryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .limit(1)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!projectId,
    enableOfflineQuery: !!projectId
  });

  return {
    project: hybrid.data[0] || null,
    isProjectLoading: hybrid.isLoading,
    ...hybrid
  };
}
