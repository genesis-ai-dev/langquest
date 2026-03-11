import { buildPericopeSequence } from '@/constants/bibleStructure';
import type { ChapterVerse } from '@/constants/bibleStructure';

const FIA_TO_BIBLE_BOOK_ID: Record<string, string> = {
  mrk: 'mar',
  php: 'phi',
  jol: 'joe',
  nam: 'nah'
};

export function getBibleBookIdFromFia(fiaBookId: string): string {
  return FIA_TO_BIBLE_BOOK_ID[fiaBookId] ?? fiaBookId;
}

export function parseFiaVerseRange(verseRange: string): {
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
} | null {
  const match = /^(\d+):(\d+)[a-z]?-(?:(\d+):)?(\d+)[a-z]?$/.exec(verseRange);
  if (!match) return null;
  const startChapter = parseInt(match[1]!, 10);
  const startVerse = parseInt(match[2]!, 10);
  const endChapter = match[3] ? parseInt(match[3], 10) : startChapter;
  const endVerse = parseInt(match[4]!, 10);
  return { startChapter, startVerse, endChapter, endVerse };
}

function parseMetadataObject(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
}

export function extractFiaMetadata(metadata: unknown): {
  bookId?: string;
  verseRange?: string;
} | null {
  const parsed = parseMetadataObject(metadata);
  if (!parsed) return null;

  const fia = parsed.fia;
  if (!fia || typeof fia !== 'object') return null;

  const fiaObj = fia as { bookId?: unknown; verseRange?: unknown };
  return {
    bookId: typeof fiaObj.bookId === 'string' ? fiaObj.bookId : undefined,
    verseRange:
      typeof fiaObj.verseRange === 'string' ? fiaObj.verseRange : undefined
  };
}

export function getFiaSequenceFromQuestMetadata(
  questMetadata: unknown
): ChapterVerse[] | null {
  const fiaMeta = extractFiaMetadata(questMetadata);
  if (!fiaMeta?.bookId || !fiaMeta.verseRange) return null;

  const range = parseFiaVerseRange(fiaMeta.verseRange);
  if (!range) return null;

  const bibleBookId = getBibleBookIdFromFia(fiaMeta.bookId);
  const sequence = buildPericopeSequence(
    bibleBookId,
    range.startChapter,
    range.startVerse,
    range.endChapter,
    range.endVerse
  );

  return sequence.length > 0 ? sequence : null;
}