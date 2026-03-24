import { useAuth } from '@/contexts/AuthContext';
import { fiaBibleApiQueryOptions } from '@/utils/fiaBibleQueryCache';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

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

export interface BibleBrainCopyrightOrg {
  name: string;
  logoUrl: string | null;
  url: string | null;
}

export interface BibleBrainCopyright {
  copyright: string;
  copyrightDate: string | null;
  organizations: BibleBrainCopyrightOrg[];
}

export interface BibleBrainContentResponse {
  verses: BibleBrainVerse[];
  audio: BibleBrainAudioChapter[];
  copyright: BibleBrainCopyright | null;
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

/**
 * Fetches Bible Brain content for a verse range, with chapter-level caching.
 *
 * The query key is based on chapter bounds (not the full verse range) so that
 * multiple pericopes within the same chapter share a single cached response
 * and a single set of audio URLs — avoiding duplicate API calls and duplicate
 * audio file downloads.
 *
 * Full-chapter text is fetched once, then filtered client-side to the
 * requested pericope's verse range.
 */
export function useBibleBrainContent(
  bibleId: string | null | undefined,
  fiaBookId: string | undefined,
  verseRange: string | undefined
) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const parsed = verseRange ? parseFiaVerseRange(verseRange) : null;
  const bookId = fiaBookId?.toUpperCase();

  // Chapter-level query key: all pericopes in the same chapter(s) share this
  // entry, so we only fetch + cache the data once.
  const {
    data: chapterData,
    isLoading,
    error
  } = useQuery({
    queryKey: [
      'bible-brain-content',
      bibleId,
      bookId,
      parsed?.startChapter ?? null,
      parsed?.endChapter ?? null
    ],
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
            startVerse: 1,
            endChapter: parsed.endChapter,
            endVerse: 999
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

  // Filter full-chapter verses down to this pericope's range.
  // Audio stays untouched — it's already chapter-granular and shared.
  const data = useMemo((): BibleBrainContentResponse | null => {
    if (!chapterData || !parsed) return null;

    const filteredVerses = chapterData.verses.filter((v) => {
      if (v.chapter < parsed.startChapter || v.chapter > parsed.endChapter)
        return false;
      if (v.chapter === parsed.startChapter && v.verseStart < parsed.startVerse)
        return false;
      if (v.chapter === parsed.endChapter && v.verseStart > parsed.endVerse)
        return false;
      return true;
    });

    return {
      verses: filteredVerses,
      audio: chapterData.audio,
      copyright: chapterData.copyright ?? null
    };
  }, [chapterData, parsed]);

  return {
    data,
    isLoading,
    error
  };
}
