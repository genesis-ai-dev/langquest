import { useAuth } from '@/contexts/AuthContext';
import { fiaBibleApiQueryOptions } from '@/utils/fiaBibleQueryCache';
import { useQuery } from '@tanstack/react-query';

// --- Types matching the edge function response ---

export interface BibleBrainVerse {
  chapter: number;
  verseStart: number;
  verseText: string;
}

export interface BibleBrainAudioChapter {
  chapter: number;
  url: string;
  duration: number;
  timestamps?: Array<{ verseStart: number; timestamp: number }>;
}

export interface BibleBrainContentResponse {
  verses: BibleBrainVerse[];
  audio: BibleBrainAudioChapter[];
}

// --- Verse range parsing (matches BibleAssetsView.parseFiaVerseRange) ---
// Sub-verse letters (a, b, c…) are stripped — "6a" becomes verse 6.

function parseFiaVerseRange(verseRange: string): {
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
} | null {
  const match = verseRange.match(/^(\d+):(\d+)[a-z]?-(?:(\d+):)?(\d+)[a-z]?$/);
  if (!match) return null;
  const startChapter = parseInt(match[1]!, 10);
  const startVerse = parseInt(match[2]!, 10);
  const endChapter = match[3] ? parseInt(match[3], 10) : startChapter;
  const endVerse = parseInt(match[4]!, 10);
  return { startChapter, startVerse, endChapter, endVerse };
}

// --- Hook ---

export function useBibleBrainContent(
  bibleId: string | null | undefined,
  fiaBookId: string | undefined,
  verseRange: string | undefined
) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const parsed = verseRange ? parseFiaVerseRange(verseRange) : null;
  const bookId = fiaBookId?.toUpperCase();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bible-brain-content', bibleId, bookId, verseRange],
    queryFn: async (): Promise<BibleBrainContentResponse | null> => {
      if (!bibleId || !parsed || !bookId) return null;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/bible-brain-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'get-content',
            bibleId,
            bookId,
            startChapter: parsed.startChapter,
            startVerse: parsed.startVerse,
            endChapter: parsed.endChapter,
            endVerse: parsed.endVerse
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bible Brain get-content request failed (${response.status}): ${errorText}`
        );
      }

      return response.json();
    },
    enabled: !!bibleId && !!parsed && !!bookId && !!supabaseUrl,
    ...fiaBibleApiQueryOptions,
    retry: 2
  });

  return {
    data: data ?? null,
    isLoading,
    error
  };
}
