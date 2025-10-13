/**
 * Utilities for managing Bible reference tags
 * 
 * Bible content is identified using the tag system with these keys:
 * - bible:book -> book ID (e.g., "gen", "mat")
 * - bible:chapter -> chapter number (e.g., "1", "2")
 * - bible:verse_start -> optional start verse
 * - bible:verse_end -> optional end verse
 */

import type { getBibleBook } from '@/constants/bibleStructure';

// Tag key constants
export const BIBLE_TAG_KEYS = {
    BOOK: 'bible:book',
    CHAPTER: 'bible:chapter',
    VERSE_START: 'bible:verse_start',
    VERSE_END: 'bible:verse_end'
} as const;

export interface BibleTags {
    book: {
        key: string;
        value: string;
    };
    chapter: {
        key: string;
        value: string;
    };
    verse_start?: {
        key: string;
        value: string;
    };
    verse_end?: {
        key: string;
        value: string;
    };
}

/**
 * Create Bible tags for a chapter
 */
export function createBibleChapterTags(
    bookId: string,
    chapter: number
): BibleTags {
    return {
        book: {
            key: BIBLE_TAG_KEYS.BOOK,
            value: bookId
        },
        chapter: {
            key: BIBLE_TAG_KEYS.CHAPTER,
            value: String(chapter)
        }
    };
}

/**
 * Create Bible tags for a verse or verse range
 */
export function createBibleVerseTags(
    bookId: string,
    chapter: number,
    verseStart: number,
    verseEnd?: number
): BibleTags {
    const tags = createBibleChapterTags(bookId, chapter);

    tags.verse_start = {
        key: BIBLE_TAG_KEYS.VERSE_START,
        value: String(verseStart)
    };

    if (verseEnd !== undefined && verseEnd !== verseStart) {
        tags.verse_end = {
            key: BIBLE_TAG_KEYS.VERSE_END,
            value: String(verseEnd)
        };
    }

    return tags;
}

/**
 * Parse Bible reference from tags
 */
export function parseBibleTags(tags: { key: string; value: string }[]): {
    bookId?: string;
    chapter?: number;
    verseStart?: number;
    verseEnd?: number;
} {
    const bookTag = tags.find(t => t.key === BIBLE_TAG_KEYS.BOOK);
    const chapterTag = tags.find(t => t.key === BIBLE_TAG_KEYS.CHAPTER);
    const verseStartTag = tags.find(t => t.key === BIBLE_TAG_KEYS.VERSE_START);
    const verseEndTag = tags.find(t => t.key === BIBLE_TAG_KEYS.VERSE_END);

    return {
        bookId: bookTag?.value,
        chapter: chapterTag ? parseInt(chapterTag.value, 10) : undefined,
        verseStart: verseStartTag ? parseInt(verseStartTag.value, 10) : undefined,
        verseEnd: verseEndTag ? parseInt(verseEndTag.value, 10) : undefined
    };
}

/**
 * Check if a quest/asset has Bible tags
 */
export function hasBibleTags(tags: { key: string; value: string }[]): boolean {
    return tags.some(t => t.key === BIBLE_TAG_KEYS.BOOK);
}

/**
 * Get a formatted reference string from Bible tags
 * e.g., "Genesis 1:1-5"
 */
export function formatBibleTagsReference(
    tags: { key: string; value: string }[],
    getBibleBookFn: typeof getBibleBook
): string | null {
    const parsed = parseBibleTags(tags);

    if (!parsed.bookId || !parsed.chapter) {
        return null;
    }

    const book = getBibleBookFn(parsed.bookId);
    if (!book) {
        return null;
    }

    let ref = `${book.name} ${parsed.chapter}`;

    if (parsed.verseStart) {
        ref += `:${parsed.verseStart}`;
        if (parsed.verseEnd && parsed.verseEnd !== parsed.verseStart) {
            ref += `-${parsed.verseEnd}`;
        }
    }

    return ref;
}
