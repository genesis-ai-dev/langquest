/**
 * Resolves the FIA API language code (e.g. "eng", "fra") for a project's source languoid.
 */

import { languoid_property } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectSourceLanguoid } from '@/hooks/useProjectSourceLanguoid';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';

export function useProjectFiaLanguageCode(projectId: string | undefined) {
  const { sourceLanguoidId, isLoading: sourceLoading } =
    useProjectSourceLanguoid(projectId ?? '');

  const { data, isLoading: codeLoading } = useHybridQuery<{
    id: string;
    value: string;
  }>({
    queryKey: ['fia-language-code', sourceLanguoidId ?? ''],
    enabled: !!sourceLanguoidId,
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: languoid_property.id,
          value: languoid_property.value
        })
        .from(languoid_property)
        .where(
          and(
            eq(languoid_property.languoid_id, sourceLanguoidId ?? ''),
            eq(languoid_property.key, 'fia_language_code'),
            eq(languoid_property.active, true)
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      if (!sourceLanguoidId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('languoid_property')
        .select('id, value')
        .eq('languoid_id', sourceLanguoidId)
        .eq('key', 'fia_language_code')
        .eq('active', true)
        .limit(1);

      if (error) throw error;
      return data ?? [];
    }
  });

  return {
    fiaLanguageCode: data[0]?.value ?? null,
    isLoading: sourceLoading || codeLoading
  };
}
