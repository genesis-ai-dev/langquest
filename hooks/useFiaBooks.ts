/**
 * Hook to fetch FIA books and pericopes for a given source language.
 * Looks up the fia_language_code from languoid_property, then calls
 * the fia-pericopes edge function.
 */

import { useAuth } from '@/contexts/AuthContext';
import { lookupFiaLanguageCode } from '@/utils/languoidLookups';
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
