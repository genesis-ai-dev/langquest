/**
 * Resolves the FIA API language code (e.g. "eng", "fra") for a project's source languoid.
 */

import { useProjectSourceLanguoid } from '@/hooks/useProjectSourceLanguoid';
import { lookupFiaLanguageCode } from '@/utils/languoidLookups';
import { useQuery } from '@tanstack/react-query';

export function useProjectFiaLanguageCode(projectId: string | undefined) {
  const { sourceLanguoidId, isLoading: sourceLoading } =
    useProjectSourceLanguoid(projectId ?? '');

  const { data: fiaLanguageCode, isLoading: codeLoading } = useQuery({
    queryKey: ['fia-language-code', sourceLanguoidId],
    queryFn: () => lookupFiaLanguageCode(sourceLanguoidId!),
    enabled: !!sourceLanguoidId,
    staleTime: Infinity
  });

  return {
    fiaLanguageCode: fiaLanguageCode ?? null,
    isLoading: sourceLoading || codeLoading
  };
}
