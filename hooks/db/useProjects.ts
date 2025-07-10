import type { project as projectTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { InferSelectModel } from 'drizzle-orm';
import {
  useHybridSupabaseInfiniteQuery,
  useHybridSupabaseQuery
} from '../useHybridSupabaseQuery';

export type Project = InferSelectModel<typeof projectTable>;

const { db } = system;

export function useInfiniteProjects(
  options: {
    pageSize?: number;
    sortField?: keyof typeof projectTable._.columns;
    sortOrder?: 'asc' | 'desc';
  } & Pick<
    Required<Parameters<typeof system.db.query.project.findMany>>[0],
    'with' | 'columns' | 'extras'
  >
) {
  const { pageSize = 10, sortField, sortOrder, ...rest } = options;

  return useHybridSupabaseInfiniteQuery<Project>({
    queryKey: ['projects', 'infinite', pageSize, sortField, sortOrder],
    query: ({ pageParam }) => {
      return db.query.project.findMany({
        where: (fields, { eq, and }) =>
          and(eq(fields.visible, true), eq(fields.active, true)),
        limit: pageSize,
        offset: pageParam * pageSize,
        ...(sortOrder &&
          sortField && {
            orderBy: (fields, { ...options }) =>
              options[sortOrder](fields[sortField])
          }),
        ...rest
      });
    },
    pageSize
  });
}

/**
 * Returns { project, isLoading, error }
 * Fetches a single project by ID from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjectById(projectId: string | undefined) {
  // Main query using hybrid query
  const {
    data: projectArray,
    isLoading: isProjectLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId, // NOTE: only run the query if projectId is defined
    query: db.query.project.findMany({
      where: (fields, { eq, and }) =>
        and(
          eq(fields.id, projectId!),
          eq(fields.visible, true),
          eq(fields.active, true)
        ),
      limit: 1
    })
  });

  const project = projectArray?.[0] || null;

  return { project, isProjectLoading, ...rest };
}
