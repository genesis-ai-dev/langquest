/**
 * Hook to fetch the step 1 ("Hear and Heart") text for an FIA pericope.
 * Chains: projectId -> source languoid -> FIA language code -> edge function.
 */

import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useQuery } from '@tanstack/react-query';

interface FiaPericopeTextResult {
  text: string;
  stepTitle: string;
}

/**
 * Look up the FIA language code for a languoid (local DB then cloud fallback).
 * Duplicated from useFiaBooks to keep hooks self-contained.
 */
async function lookupFiaLanguageCode(
  languoidId: string
): Promise<string | null> {
  try {
    const localResult = await system.db.execute(
      `SELECT value FROM languoid_property
       WHERE languoid_id = '${languoidId}'
         AND key = 'fia_language_code'
         AND active = 1
       LIMIT 1`
    );

    if (localResult.rows?._array && localResult.rows._array.length > 0) {
      return (localResult.rows._array[0] as { value: string }).value;
    }
  } catch {
    // Fall through to cloud
  }

  const { data, error } = await system.supabaseConnector.client
    .from('languoid_property')
    .select('value')
    .eq('languoid_id', languoidId)
    .eq('key', 'fia_language_code')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
}

/**
 * Look up the source languoid ID for a project.
 */
async function lookupSourceLanguoidId(
  projectId: string
): Promise<string | null> {
  // Cloud first (reliable right after creation)
  try {
    const { data, error } = await system.supabaseConnector.client
      .from('project_language_link')
      .select('languoid_id')
      .eq('project_id', projectId)
      .eq('language_type', 'source')
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data.languoid_id;
  } catch {
    // Fall through to local
  }

  // Local fallback
  try {
    const result = await system.db.execute(
      `SELECT languoid_id FROM project_language_link
       WHERE project_id = '${projectId}'
         AND language_type = 'source'
         AND active = 1
       LIMIT 1`
    );
    const row = result.rows?._array?.[0] as
      | { languoid_id: string }
      | undefined;
    if (row) return row.languoid_id;
  } catch {
    // No result
  }

  return null;
}

export function useFiaPericopeText(
  projectId: string | undefined,
  pericopeId: string | undefined
) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const { data, isLoading, error } = useQuery({
    queryKey: ['fia-pericope-text', projectId, pericopeId],
    queryFn: async (): Promise<FiaPericopeTextResult | null> => {
      if (!projectId || !pericopeId) return null;

      // Step 1: Get source languoid
      const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
      if (!sourceLanguoidId) {
        throw new Error('Could not find source languoid for project');
      }

      // Step 2: Get FIA language code
      const fiaCode = await lookupFiaLanguageCode(sourceLanguoidId);
      if (!fiaCode) {
        throw new Error(
          `No FIA language code found for languoid ${sourceLanguoidId}`
        );
      }

      // Step 3: Call edge function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/fia-pericope-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            pericopeId,
            fiaLanguageCode: fiaCode
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `FIA pericope text request failed (${response.status}): ${errorText}`
        );
      }

      return response.json();
    },
    enabled: !!projectId && !!pericopeId && !!supabaseUrl,
    staleTime: Infinity, // Text won't change during a session
    retry: 2
  });

  return {
    text: data?.text ?? null,
    stepTitle: data?.stepTitle ?? null,
    isLoading,
    error
  };
}
