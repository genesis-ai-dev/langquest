/**
 * Hook to fetch the source languoid for a project (used by FIA projects).
 * Queries project_language_link where language_type = 'source'.
 */

import { system } from '@/db/powersync/system';
import { useQuery } from '@tanstack/react-query';

export function useProjectSourceLanguoid(projectId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['project-source-languoid', projectId],
    queryFn: async (): Promise<string | null> => {
      if (!projectId) return null;

      console.log(
        `[useProjectSourceLanguoid] Looking up source languoid for project ${projectId}`
      );

      // Try Supabase cloud first (most reliable right after project creation)
      try {
        const { data: cloudData, error } =
          await system.supabaseConnector.client
            .from('project_language_link')
            .select('languoid_id')
            .eq('project_id', projectId)
            .eq('language_type', 'source')
            .eq('active', true)
            .limit(1)
            .maybeSingle();

        if (error) {
          console.warn(
            `[useProjectSourceLanguoid] Cloud query error:`,
            error
          );
        } else if (cloudData) {
          console.log(
            `[useProjectSourceLanguoid] Found source languoid in cloud: ${cloudData.languoid_id}`
          );
          return cloudData.languoid_id;
        } else {
          console.log(
            `[useProjectSourceLanguoid] No source languoid in cloud`
          );
        }
      } catch (cloudError) {
        console.warn(
          `[useProjectSourceLanguoid] Cloud lookup failed:`,
          cloudError
        );
      }

      // Fallback: try local DB (project_language_link syncs via PowerSync)
      try {
        const localResult = await system.db.execute(
          `SELECT languoid_id, language_type, active FROM project_language_link
           WHERE project_id = '${projectId}'`
        );

        console.log(
          `[useProjectSourceLanguoid] Local DB has ${localResult.rows?._array?.length ?? 0} language links`
        );

        const sourceRow = localResult.rows?._array?.find(
          (r: Record<string, unknown>) =>
            r.language_type === 'source' &&
            (r.active === 1 || r.active === true)
        ) as { languoid_id: string } | undefined;

        if (sourceRow) {
          console.log(
            `[useProjectSourceLanguoid] Found source languoid locally: ${sourceRow.languoid_id}`
          );
          return sourceRow.languoid_id;
        }
      } catch (localError) {
        console.warn(
          `[useProjectSourceLanguoid] Local DB query failed:`,
          localError
        );
      }

      console.log(
        `[useProjectSourceLanguoid] No source languoid found anywhere`
      );
      return null;
    },
    enabled: !!projectId,
    staleTime: Infinity,
    retry: 3,
    retryDelay: 2000
  });

  return {
    sourceLanguoidId: data ?? null,
    isLoading
  };
}
