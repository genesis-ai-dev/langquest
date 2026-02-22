/**
 * Hook to fetch FIA books and pericopes for a given source language.
 * Looks up the fia_language_code from languoid_property, then calls
 * the fia-pericopes edge function.
 */

import { system } from '@/db/powersync/system';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

export interface FiaPericope {
  id: string; // e.g. "mrk-p1"
  sequence: number;
  verseRange: string; // e.g. "1:1-13"
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

export interface FiaBook {
  id: string; // e.g. "mrk"
  title: string; // Translated book title
  pericopes: FiaPericope[];
}

interface FiaPericopesResponse {
  books: FiaBook[];
}

/**
 * Fetch the fia_language_code for a languoid from languoid_property
 */
async function lookupFiaLanguageCode(
  languoidId: string
): Promise<string | null> {
  // Try local DB first (may not have the data if download_profiles is NULL)
  try {
    const localResult = await system.db.execute(
      `SELECT value FROM languoid_property
       WHERE languoid_id = '${languoidId}'
         AND key = 'fia_language_code'
         AND active = 1
       LIMIT 1`
    );

    if (localResult.rows?._array && localResult.rows._array.length > 0) {
      const code = (localResult.rows._array[0] as { value: string }).value;
      console.log(`[lookupFiaLanguageCode] Found locally: ${code}`);
      return code;
    }
  } catch (localError) {
    console.warn(`[lookupFiaLanguageCode] Local DB query failed:`, localError);
  }

  // Fallback to Supabase cloud (fia_language_code records may not sync locally)
  console.log(
    `[lookupFiaLanguageCode] Not found locally, checking Supabase cloud for languoid ${languoidId}`
  );
  const { data, error } = await system.supabaseConnector.client
    .from('languoid_property')
    .select('value')
    .eq('languoid_id', languoidId)
    .eq('key', 'fia_language_code')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[lookupFiaLanguageCode] Cloud query error:`, error);
    return null;
  }
  if (!data) {
    console.warn(
      `[lookupFiaLanguageCode] No fia_language_code found in cloud either`
    );
    return null;
  }
  console.log(`[lookupFiaLanguageCode] Found in cloud: ${data.value}`);
  return data.value;
}

export function useFiaBooks(sourceLanguoidId: string | null) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const {
    data: booksData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['fia-books', sourceLanguoidId],
    queryFn: async (): Promise<FiaBook[]> => {
      if (!sourceLanguoidId) return [];

      console.log(
        `[useFiaBooks] Looking up FIA language code for languoid ${sourceLanguoidId}`
      );

      // Step 1: Look up FIA language code
      const fiaCode = await lookupFiaLanguageCode(sourceLanguoidId);
      if (!fiaCode) {
        throw new Error(
          `No FIA language code found for languoid ${sourceLanguoidId}`
        );
      }

      console.log(
        `[useFiaBooks] FIA code: ${fiaCode}, calling edge function at ${supabaseUrl}/functions/v1/fia-pericopes`
      );

      // Step 2: Call edge function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/fia-pericopes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ fiaLanguageCode: fiaCode })
        }
      );

      console.log(
        `[useFiaBooks] Edge function response status: ${response.status}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[useFiaBooks] Edge function error:`, errorText);
        throw new Error(
          `FIA API request failed (${response.status}): ${errorText}`
        );
      }

      const result: FiaPericopesResponse = await response.json();
      console.log(
        `[useFiaBooks] Got ${result.books.length} books from FIA API`
      );
      return result.books;
    },
    enabled: !!sourceLanguoidId && !!supabaseUrl,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes - FIA book list rarely changes
    retry: 2
  });

  return {
    books: booksData ?? [],
    isLoading,
    error,
    refetch
  };
}
