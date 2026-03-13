import { useAuth } from '@/contexts/AuthContext';
import type { BibleBrainBible } from '@/hooks/useBibleBrainBibles';
import type { BibleBrainContentResponse } from '@/hooks/useBibleBrainContent';
import type { FiaPericope } from '@/hooks/useFiaBooks';
import {
  cacheBibleText,
  downloadBibleAudio,
  isBibleAudioCached,
  isBibleTextCached
} from '@/utils/bible-cache';
import {
  fetchAndCacheFiaPericope,
  isFiaPericopeCached
} from '@/utils/fia-cache';
import { useCallback, useState } from 'react';

export type BookDownloadStatus =
  | { phase: 'idle' }
  | {
      phase: 'downloading-bible';
      current: number;
      total: number;
      currentLabel: string;
    }
  | {
      phase: 'downloading-fia';
      current: number;
      total: number;
      currentLabel: string;
    }
  | { phase: 'done'; textCount: number; audioCount: number; fiaCount: number }
  | { phase: 'error'; message: string; completed: number; total: number };

function parseFiaVerseRange(verseRange: string) {
  const match = verseRange.match(/^(\d+):(\d+)[a-z]?-(?:(\d+):)?(\d+)[a-z]?$/);
  if (!match) return null;
  return {
    startChapter: parseInt(match[1]!, 10),
    startVerse: parseInt(match[2]!, 10),
    endChapter: match[3] ? parseInt(match[3], 10) : parseInt(match[1]!, 10),
    endVerse: parseInt(match[4]!, 10)
  };
}

/**
 * Hook for batch-downloading Bible text + audio for every pericope in a book.
 * Fetches each pericope's content from the edge function, caches text automatically,
 * and downloads audio files to disk.
 */
export function useBibleBookDownload() {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const [status, setStatus] = useState<BookDownloadStatus>({ phase: 'idle' });
  const [cancelledRef] = useState({ current: false });

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, [cancelledRef]);

  const downloadBook = useCallback(
    async (
      bible: BibleBrainBible,
      pericopes: FiaPericope[],
      fiaBookId: string,
      projectId: string,
      options?: { includeAudio?: boolean }
    ) => {
      const includeAudio = options?.includeAudio ?? bible.hasAudio;
      const bookId = fiaBookId.toUpperCase();
      const total = pericopes.length;
      cancelledRef.current = false;

      let textCount = 0;
      let audioCount = 0;
      let fiaCount = 0;

      // --- Phase 1: Bible text + audio ---
      setStatus({
        phase: 'downloading-bible',
        current: 0,
        total,
        currentLabel: 'Starting...'
      });

      for (let i = 0; i < pericopes.length; i++) {
        if (cancelledRef.current) {
          setStatus({ phase: 'idle' });
          return;
        }

        const pericope = pericopes[i]!;
        const verseRange = pericope.verseRange;
        const parsed = parseFiaVerseRange(verseRange);
        if (!parsed) continue;

        setStatus({
          phase: 'downloading-bible',
          current: i,
          total,
          currentLabel: `p${i + 1} — ${verseRange}`
        });

        const textAlreadyCached = bible.textFilesetId
          ? isBibleTextCached(bible.textFilesetId, bookId, verseRange)
          : false;
        const audioAlreadyCached =
          includeAudio && bible.audioFilesetId
            ? isBibleAudioCached(bible.audioFilesetId, bookId, verseRange)
            : false;

        if (textAlreadyCached && (!includeAudio || audioAlreadyCached)) {
          if (textAlreadyCached) textCount++;
          if (audioAlreadyCached) audioCount++;
          continue;
        }

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
                textFilesetId: bible.textFilesetId ?? null,
                audioFilesetId: bible.audioFilesetId ?? null,
                bookId,
                startChapter: parsed.startChapter,
                startVerse: parsed.startVerse,
                endChapter: parsed.endChapter,
                endVerse: parsed.endVerse
              })
            }
          );

          if (!response.ok) continue;
          const data: BibleBrainContentResponse = await response.json();

          if (bible.textFilesetId && data.verses.length > 0 && !textAlreadyCached) {
            await cacheBibleText(bible.textFilesetId, bookId, verseRange, data);
            textCount++;
          } else if (textAlreadyCached) {
            textCount++;
          }

          if (
            includeAudio &&
            bible.audioFilesetId &&
            data.audio.length > 0 &&
            !audioAlreadyCached
          ) {
            if (cancelledRef.current) {
              setStatus({ phase: 'idle' });
              return;
            }
            await downloadBibleAudio(
              bible.audioFilesetId,
              bookId,
              verseRange,
              data.audio
            );
            audioCount++;
          } else if (audioAlreadyCached) {
            audioCount++;
          }
        } catch (e) {
          console.error(`[BibleBookDownload] Bible failed for ${verseRange}:`, e);
          setStatus({
            phase: 'error',
            message: e instanceof Error ? e.message : 'Download failed',
            completed: i,
            total
          });
          return;
        }
      }

      // --- Phase 2: FIA guide content ---
      setStatus({
        phase: 'downloading-fia',
        current: 0,
        total,
        currentLabel: 'Starting...'
      });

      for (let i = 0; i < pericopes.length; i++) {
        if (cancelledRef.current) {
          setStatus({ phase: 'idle' });
          return;
        }

        const pericope = pericopes[i]!;

        setStatus({
          phase: 'downloading-fia',
          current: i,
          total,
          currentLabel: `p${i + 1} — ${pericope.verseRange}`
        });

        if (isFiaPericopeCached(pericope.id)) {
          fiaCount++;
          continue;
        }

        try {
          await fetchAndCacheFiaPericope(
            projectId,
            pericope.id,
            session?.access_token
          );
          fiaCount++;
        } catch (e) {
          console.error(
            `[BibleBookDownload] FIA failed for ${pericope.id}:`,
            e
          );
          // Non-fatal: continue to next pericope
        }
      }

      setStatus({ phase: 'done', textCount, audioCount, fiaCount });
    },
    [session?.access_token, supabaseUrl, cancelledRef]
  );

  const reset = useCallback(() => {
    setStatus({ phase: 'idle' });
  }, []);

  return { status, downloadBook, cancel, reset };
}
