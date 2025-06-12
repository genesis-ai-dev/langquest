import { useSystem } from '@/contexts/SystemContext';
import type { project as projectTable } from '@/db/drizzleSchema';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { useHybridQuery } from '../useHybridQuery';

export type Project = InferSelectModel<typeof projectTable>;

/**
 * Returns { projects, isLoading, error }
 * Fetches projects from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjects() {
  const { db, supabaseConnector } = useSystem();

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
        .eq('visible', true)
        .eq('active', true)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: (fields, { eq, and }) =>
          and(eq(fields.visible, true), eq(fields.active, true))
      })
    ),
    alwaysOnline: true
  });

  return { projects, isProjectsLoading, ...rest };
}

/**
 * Returns { project, isLoading, error }
 * Fetches a single project by ID from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useProjectById(projectId: string | undefined) {
  const { db, supabaseConnector } = useSystem();

  // Main query using hybrid query
  const {
    data: projectArray,
    isLoading: isProjectLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
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
