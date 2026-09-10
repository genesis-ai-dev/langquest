import { project as projectTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';

export type Project = InferSelectModel<typeof projectTable>;

export function useProjectById(projectId: string | undefined) {
  const { db, supabaseConnector } = system;

  const hybrid = useHybridQuery({
    queryKey: ['project', projectId || ''],
    offlineQuery: toCompilableQuery(
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
