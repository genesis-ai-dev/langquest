import { useAuth } from '@/contexts/AuthContext';
import {
  lookupIso639_3,
  lookupSourceLanguoidId
} from '@/utils/languoidLookups';
import { useQuery } from '@tanstack/react-query';

// --- Types matching the edge function response ---

export interface BibleBrainBible {
  id: string;
  name: string;
  vname: string | null;
  hasText: boolean;
  hasAudio: boolean;
  textFilesetId: string | null;
  audioFilesetId: string | null;
}

interface ListBiblesResponse {
  bibles: BibleBrainBible[];
}

export function useBibleBrainBibles(projectId: string | undefined) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const { data, isLoading, error } = useQuery({
    queryKey: ['bible-brain-bibles', projectId],
    queryFn: async (): Promise<ListBiblesResponse | null> => {
      if (!projectId) return null;

      const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
      if (!sourceLanguoidId) {
        throw new Error('Could not find source languoid for project');
      }

      const iso = await lookupIso639_3(sourceLanguoidId);
      if (!iso) {
        throw new Error(
          `No ISO 639-3 code found for languoid ${sourceLanguoidId}`
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/bible-brain-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ action: 'list-bibles', iso639_3: iso })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bible Brain list-bibles request failed (${response.status}): ${errorText}`
        );
      }

      return response.json();
    },
    enabled: !!projectId && !!supabaseUrl,
    staleTime: Infinity,
    retry: 2
  });

  return {
    bibles: data?.bibles ?? [],
    isLoading,
    error
  };
}
