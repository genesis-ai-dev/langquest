/**
 * Hook to fetch the source languoid for a project (used by FIA projects).
 * Queries project_language_link where language_type = 'source'.
 */

import { lookupSourceLanguoidId } from '@/utils/languoidLookups';
import { useQuery } from '@tanstack/react-query';

export function useProjectSourceLanguoid(projectId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['project-source-languoid', projectId],
    queryFn: () => lookupSourceLanguoidId(projectId),
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
