/**
 * Hook to fetch the source languoid for a project (used by FIA projects).
 * Queries project_language_link where language_type = 'source'.
 */

import { project_language_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';

export function useProjectSourceLanguoid(projectId: string) {
  const { data, isLoading } = useHybridQuery<{
    id: string;
    languoid_id: string;
  }>({
    queryKey: ['project-source-languoid', projectId],
    enabled: !!projectId,
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: project_language_link.languoid_id,
          languoid_id: project_language_link.languoid_id
        })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, projectId),
            eq(project_language_link.language_type, 'source'),
            eq(project_language_link.active, true)
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', projectId)
        .eq('language_type', 'source')
        .eq('active', true)
        .limit(1);

      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.languoid_id,
        languoid_id: row.languoid_id
      }));
    }
  });

  return {
    sourceLanguoidId: data[0]?.languoid_id ?? null,
    isLoading
  };
}
