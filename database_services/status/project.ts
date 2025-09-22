import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
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
    offlineQuery: toMergeCompilableQuery(
      db.query.project.findMany({
        columns: {
          private: true,
          active: true,
          visible: true
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
  status: Partial<Pick<ProjectStatus, 'private' | 'active' | 'visible'>>
) {
  const { db } = system;

  console.log('[UpdateProjectStatus]', status);

  return await db
    .update(project)
    .set({ ...status, last_updated: new Date().toISOString() })
    .where(eq(project.id, projectId));
}
