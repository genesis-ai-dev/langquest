import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { localSourceOverrideOptions, resolveTable } from '@/utils/dbUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import type { ProjectStatus } from '../types';

export interface ProjectStatusHook {
  data: ProjectStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useProjectStatuses(projectId: string): ProjectStatusHook {
  const { db, supabaseConnector } = system;

  const {
    data: projectData = [],
    refetch,
    isLoading,
    isError
  } = useHybridQuery({
    queryKey: ['project-settings', projectId],
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        columns: {
          private: true,
          active: true,
          visible: true,
          source: true
        },
        where: eq(project.id, projectId)
      })
    ),
    onlineFn: async (): Promise<(typeof project.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('private, active, visible')
        .eq('id', projectId)
        .limit(1);

      if (error) throw error;
      return data as (typeof project.$inferSelect)[];
    }
  });

  return {
    data: projectData[0] || undefined,
    isLoading,
    isError,
    refetch
  };
}

export async function updateProjectStatus(
  projectId: string,
  status: Partial<Pick<ProjectStatus, 'private' | 'active' | 'visible'>>,
  projectSource: HybridDataSource
) {
  const { db } = system;

  console.log('[UpdateProjectStatus]', status);

  const resolvedProject = resolveTable(
    'project',
    localSourceOverrideOptions(projectSource)
  );
  return await db
    .update(resolvedProject)
    .set({ ...status })
    .where(eq(resolvedProject.id, projectId));
}
