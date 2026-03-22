import { useAuth } from '@/contexts/AuthContext';
import type { BibleBrainBible } from '@/hooks/useBibleBrainBibles';
import { fiaBibleApiQueryOptions } from '@/utils/fiaBibleQueryCache';
import { useQuery } from '@tanstack/react-query';

interface ListBiblesResponse {
  bibles: BibleBrainBible[];
}

export function useBibleBrainBiblesByIso(iso: string | undefined) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const { data, isLoading, error } = useQuery({
    queryKey: ['bible-brain-bibles-by-iso', iso],
    queryFn: async (): Promise<ListBiblesResponse | null> => {
      if (!iso) return null;

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
    enabled: !!iso && !!supabaseUrl,
    ...fiaBibleApiQueryOptions,
    retry: 2
  });

  return {
    bibles: data?.bibles ?? [],
    isLoading,
    error
  };
}
