import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

export interface BibleBrainLanguage {
  iso: string;
  name: string;
  autonym: string;
}

interface ListLanguagesResponse {
  languages: BibleBrainLanguage[];
}

export function useBibleBrainLanguages(search: string) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const trimmed = search.trim();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bible-brain-languages', trimmed],
    queryFn: async (): Promise<ListLanguagesResponse | null> => {
      if (trimmed.length < 2) return null;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/bible-brain-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ action: 'list-languages', search: trimmed })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bible Brain list-languages request failed (${response.status}): ${errorText}`
        );
      }

      return response.json();
    },
    enabled: trimmed.length >= 2 && !!supabaseUrl,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1
  });

  return {
    languages: data?.languages ?? [],
    isLoading: isLoading && trimmed.length >= 2,
    error
  };
}
