/**
 * Hook to fetch the step 1 ("Hear and Heart") text for an FIA pericope.
 * Chains: projectId -> source languoid -> FIA language code -> edge function.
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  lookupFiaLanguageCode,
  lookupSourceLanguoidId
} from '@/utils/languoidLookups';
import { useQuery } from '@tanstack/react-query';

interface FiaPericopeTextResult {
  text: string;
  stepTitle: string;
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
