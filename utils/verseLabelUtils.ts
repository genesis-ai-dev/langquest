import type { ChapterVerse } from '@/constants/bibleStructure';
import {
  BIBLE_BOOKS,
  buildPericopeSequence,
  formatPericopeVerseLabel
} from '@/constants/bibleStructure';
import type { FiaMetadata } from '@/db/drizzleSchemaColumns';

// Maps FIA book IDs to BIBLE_BOOKS IDs for label/verse lookup
const FIA_TO_BIBLE_BOOK_ID: Record<string, string> = {
  mrk: 'mar',
  php: 'phi',
  jol: 'joe',
  nam: 'nah'
};

export function getBibleBookIdFromFia(fiaBookId: string): string {
  return FIA_TO_BIBLE_BOOK_ID[fiaBookId] ?? fiaBookId;
}

/**
 * Parse FIA verseRange string like "1:1-13", "4:30-5:20", or "6:1-6a"
 * Sub-verse letters (a, b, c…) are stripped — "6a" becomes verse 6.
 */
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

/**
 * Extract FIA metadata from quest metadata (handles both string and object forms)
 */
export function extractFiaMetadata(metadata: unknown): FiaMetadata | null {
  try {
    const parsed =
      typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'fia' in parsed &&
      parsed.fia &&
      typeof parsed.fia === 'object'
    ) {
      return parsed.fia as FiaMetadata;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/** Ordered verse sequence for a FIA pericope quest; null for standard chapters. */
export function getPericopeSequence(
  fiaMetadata: FiaMetadata | null
): ChapterVerse[] | null {
  if (!fiaMetadata?.verseRange || !fiaMetadata.bookId) return null;
  const parsed = parseFiaVerseRange(fiaMetadata.verseRange);
  if (!parsed) return null;
  return buildPericopeSequence(
    getBibleBookIdFromFia(fiaMetadata.bookId),
    parsed.startChapter,
    parsed.startVerse,
    parsed.endChapter,
    parsed.endVerse
  );
}

export function getPericopeBookShortName(
  fiaMetadata: FiaMetadata | null
): string | null {
  if (!fiaMetadata?.bookId) return null;
  const bibleBookId = getBibleBookIdFromFia(fiaMetadata.bookId);
  return BIBLE_BOOKS.find((b) => b.id === bibleBookId)?.shortName ?? null;
}

/**
 * Formatter mapping a 1-based verse position to its pericope label ("2:23").
 * Returns undefined for standard Bible chapters, where positions are verses.
 */
export function createQuestVerseFormatter(
  questMetadata: unknown
): ((position: number) => string | null) | undefined {
  const fiaMetadata = extractFiaMetadata(questMetadata);
  const sequence = getPericopeSequence(fiaMetadata);
  const bookShortName = getPericopeBookShortName(fiaMetadata);
  if (!sequence || !bookShortName) return undefined;
  return (position) =>
    formatPericopeVerseLabel(bookShortName, sequence, position);
}

/** Verse range from asset metadata (handles both string and object forms). */
export function getAssetVerseRange(metadata: unknown): {
  from?: number;
  to?: number;
} {
  try {
    const parsed: unknown =
      typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'verse' in parsed &&
      parsed.verse &&
      typeof parsed.verse === 'object'
    ) {
      const { from, to } = parsed.verse as { from?: unknown; to?: unknown };
      return {
        from: typeof from === 'number' ? from : undefined,
        to: typeof to === 'number' ? to : undefined
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Display label for a verse range: "Verse 3" / "Verse 3-5" for Bible chapters,
 * "2:23" / "2:23-2:25" for FIA pericopes. Null when there is no verse.
 */
export function formatVerseRangeLabel(
  from: number | undefined,
  to: number | undefined,
  formatVerse?: (position: number) => string | null
): string | null {
  if (from === undefined && to === undefined) return null;

  if (formatVerse) {
    if (from === to || from === undefined || to === undefined) {
      const value = (from ?? to)!;
      return formatVerse(value) ?? `${value}`;
    }
    const fromLabel = formatVerse(from);
    const toLabel = formatVerse(to);
    if (fromLabel && toLabel) return `${fromLabel}-${toLabel}`;
    if (fromLabel) return fromLabel;
  }

  if (from === to || from === undefined || to === undefined) {
    return `Verse ${from ?? to}`;
  }
  return `Verse ${from}-${to}`;
}
