import { asset, asset_content_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, isNotNull } from 'drizzle-orm';
import React from 'react';

const MAX_EXAMPLES = 30;

/**
 * Fetches text examples in a specific language from a project.
 * Used for providing orthography context to the transcription localization AI.
 *
 * Returns up to 30 text samples showing how the language is correctly written.
 */
export function useOrthographyExamples(
  projectId: string | null | undefined,
  languageId: string | null | undefined
) {
  const enabled =
    !!projectId && !!languageId && projectId !== '' && languageId !== '';

  const { data, isLoading, isError, cloudError, offlineError } = useHybridQuery<{
    id: string;
    text: string | null;
  }>({
    queryKey: ['orthography-examples', projectId ?? '', languageId ?? ''],
    enabled,
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: asset_content_link.id,
          text: asset_content_link.text
        })
        .from(asset_content_link)
        .innerJoin(asset, eq(asset.id, asset_content_link.asset_id))
        .where(
          and(
            eq(asset.project_id, projectId ?? ''),
            eq(asset_content_link.languoid_id, languageId ?? ''),
            eq(asset.active, true),
            eq(asset_content_link.active, true),
            isNotNull(asset_content_link.text)
          )
        )
        .limit(MAX_EXAMPLES)
    ),
    cloudQueryFn: async () => {
      if (!projectId || !languageId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('id, text, asset!inner(project_id, active)')
        .eq('languoid_id', languageId)
        .eq('active', true)
        .not('text', 'is', null)
        .eq('asset.project_id', projectId)
        .eq('asset.active', true)
        .limit(MAX_EXAMPLES);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        text: row.text
      }));
    }
  });

  const examples = React.useMemo(
    () =>
      data
        .map((row) => row.text?.trim())
        .filter((text): text is string => !!text && text.length > 0)
        .slice(0, MAX_EXAMPLES),
    [data]
  );

  return {
    data: examples,
    isLoading,
    isFetching: isLoading,
    error: cloudError ?? offlineError ?? (isError ? new Error('query') : null)
  };
}
