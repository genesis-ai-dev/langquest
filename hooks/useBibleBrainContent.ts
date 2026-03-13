import { useAuth } from '@/contexts/AuthContext';
import {
  type BibleAudioCacheManifest,
  cacheBibleText,
  downloadBibleAudio,
  getCachedBibleAudio,
  getCachedBibleText,
  isBibleAudioCached
} from '@/utils/bible-cache';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

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

// --- Audio download state ---

export type AudioDownloadState =
  | { status: 'none' }
  | { status: 'cached' }
  | { status: 'downloading'; downloaded: number; total: number }
  | { status: 'error'; message: string };

// --- Hook ---

export function useBibleBrainContent(
  textFilesetId: string | null | undefined,
  audioFilesetId: string | null | undefined,
  fiaBookId: string | undefined,
  verseRange: string | undefined
) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const hasFileset = !!textFilesetId || !!audioFilesetId;
  const parsed = verseRange ? parseFiaVerseRange(verseRange) : null;
  const bookId = fiaBookId?.toUpperCase();

  const [audioDownloadState, setAudioDownloadState] =
    useState<AudioDownloadState>({ status: 'none' });
  const [audioManifest, setAudioManifest] =
    useState<BibleAudioCacheManifest | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'bible-brain-content',
      textFilesetId,
      audioFilesetId,
      bookId,
      verseRange
    ],
    queryFn: async (): Promise<BibleBrainContentResponse | null> => {
      if (!hasFileset || !parsed || !bookId) return null;

      // Check caches
      const cachedText = textFilesetId
        ? await getCachedBibleText(textFilesetId, bookId, verseRange!)
        : null;
      const cachedAudio = audioFilesetId
        ? await getCachedBibleAudio(audioFilesetId, bookId, verseRange!)
        : null;

      if (cachedAudio) {
        setAudioManifest(cachedAudio);
        setAudioDownloadState({ status: 'cached' });
      }

      // Both text and audio are fully cached — serve entirely from disk
      if (cachedText && (!audioFilesetId || cachedAudio)) {
        return {
          verses: cachedText.verses,
          audio: cachedAudio
            ? cachedAudio.chapters.map((ch) => ({
                chapter: ch.chapter,
                url: ch.localUri,
                duration: ch.duration,
                timestamps: ch.timestamps
              }))
            : []
        };
      }

      // Fetch from network (needed for uncached text, or audio URLs for downloading)
      const buildCachedFallback = () => ({
        verses: cachedText?.verses ?? [],
        audio: cachedAudio
          ? cachedAudio.chapters.map((ch) => ({
              chapter: ch.chapter,
              url: ch.localUri,
              duration: ch.duration,
              timestamps: ch.timestamps
            }))
          : []
      });

      let result: BibleBrainContentResponse;
      try {
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
              textFilesetId: textFilesetId ?? null,
              audioFilesetId: audioFilesetId ?? null,
              bookId,
              startChapter: parsed.startChapter,
              startVerse: parsed.startVerse,
              endChapter: parsed.endChapter,
              endVerse: parsed.endVerse
            })
          }
        );

        if (!response.ok) {
          if (cachedText) return buildCachedFallback();
          const errorText = await response.text();
          throw new Error(
            `Bible Brain get-content request failed (${response.status}): ${errorText}`
          );
        }

        result = await response.json();
      } catch (e) {
        // Network error — return whatever cache we have
        if (cachedText) return buildCachedFallback();
        throw e;
      }

      // Auto-cache text (small files, cache aggressively)
      if (textFilesetId && result.verses.length > 0) {
        void cacheBibleText(textFilesetId, bookId, verseRange!, result);
      }

      // If audio is already cached, use local files for playback
      if (cachedAudio) {
        return {
          verses: result.verses,
          audio: cachedAudio.chapters.map((ch) => ({
            chapter: ch.chapter,
            url: ch.localUri,
            duration: ch.duration,
            timestamps: ch.timestamps
          }))
        };
      }

      return result;
    },
    enabled: hasFileset && !!parsed && !!bookId && !!supabaseUrl,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 2
  });

  const downloadAudio = useCallback(async () => {
    if (
      !audioFilesetId ||
      !bookId ||
      !verseRange ||
      !data?.audio?.length ||
      audioDownloadState.status === 'downloading'
    ) {
      return;
    }

    setAudioDownloadState({ status: 'downloading', downloaded: 0, total: data.audio.length });

    try {
      const manifest = await downloadBibleAudio(
        audioFilesetId,
        bookId,
        verseRange,
        data.audio,
        (downloaded, total) => {
          setAudioDownloadState({ status: 'downloading', downloaded, total });
        }
      );

      setAudioManifest(manifest);
      setAudioDownloadState({ status: 'cached' });
    } catch (e) {
      setAudioDownloadState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Download failed'
      });
    }
  }, [audioFilesetId, bookId, verseRange, data?.audio, audioDownloadState.status]);

  const cachedAudioUrls = useMemo(() => {
    if (!audioManifest) return null;
    return audioManifest.chapters.map((ch) => ch.localUri);
  }, [audioManifest]);

  return {
    data: data ?? null,
    isLoading,
    error,
    audioDownloadState,
    downloadAudio,
    cachedAudioUrls
  };
}
