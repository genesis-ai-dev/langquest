import bibleData from './bible-data.json';

// Bible structure with books, chapters, and verse counts
export interface BibleBook {
    id: string;
    name: string;
    chapters: number;
    verses: number[]; // verses per chapter
}

export interface BibleReference {
    book: string;
    chapter: number;
    verse: number;
}

// Transform the bible-data.json into our BibleBook format
export const BIBLE_BOOKS: BibleBook[] = bibleData.map(book => {
    const chapterEntries = Object.entries(book.chapters).sort(([a], [b]) => parseInt(a) - parseInt(b));
    return {
        id: book.abbr,
        name: book.name,
        chapters: chapterEntries.length,
        verses: chapterEntries.map(([, verseCount]) => verseCount as number)
    };
});

// Utility functions
export const getBibleBook = (bookId: string): BibleBook | undefined => {
    return BIBLE_BOOKS.find(book => book.id === bookId);
};

export const getMaxVersesInChapter = (bookId: string, chapter: number): number => {
    const book = getBibleBook(bookId);
    if (!book || chapter < 1 || chapter > book.chapters) {
        return 0;
    }
    return book.verses[chapter - 1] || 0;
};

export const getNextVerse = (reference: BibleReference): BibleReference | null => {
    const book = getBibleBook(reference.book);
    if (!book) return null;

    const maxVersesInChapter = getMaxVersesInChapter(reference.book, reference.chapter);

    // Next verse in same chapter
    if (reference.verse < maxVersesInChapter) {
        return {
            ...reference,
            verse: reference.verse + 1
        };
    }

    // Next chapter in same book
    if (reference.chapter < book.chapters) {
        return {
            ...reference,
            chapter: reference.chapter + 1,
            verse: 1
        };
    }

    // Next book
    const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.id === reference.book);
    if (currentBookIndex < BIBLE_BOOKS.length - 1) {
        const nextBook = BIBLE_BOOKS[currentBookIndex + 1];
        if (nextBook) {
            return {
                book: nextBook.id,
                chapter: 1,
                verse: 1
            };
        }
    }

    return null; // End of Bible
};

export const getPreviousVerse = (reference: BibleReference): BibleReference | null => {
    const book = getBibleBook(reference.book);
    if (!book) return null;

    // Previous verse in same chapter
    if (reference.verse > 1) {
        return {
            ...reference,
            verse: reference.verse - 1
        };
    }

    // Previous chapter in same book
    if (reference.chapter > 1) {
        const previousChapter = reference.chapter - 1;
        const maxVersesInPreviousChapter = getMaxVersesInChapter(reference.book, previousChapter);
        return {
            ...reference,
            chapter: previousChapter,
            verse: maxVersesInPreviousChapter
        };
    }

    // Previous book
    const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.id === reference.book);
    if (currentBookIndex > 0) {
        const previousBook = BIBLE_BOOKS[currentBookIndex - 1];
        if (previousBook) {
            const maxVersesInLastChapter = getMaxVersesInChapter(previousBook.id, previousBook.chapters);
            return {
                book: previousBook.id,
                chapter: previousBook.chapters,
                verse: maxVersesInLastChapter
            };
        }
    }

    return null; // Beginning of Bible
};

export const formatBibleReference = (reference: BibleReference): string => {
    const book = getBibleBook(reference.book);
    if (!book) return '';

    return `${book.name} ${reference.chapter}:${reference.verse}`;
};

export const parseBibleReference = (reference: string): BibleReference | null => {
    // Simple parser - could be enhanced
    const match = /^(.+?)\s+(\d+):(\d+)$/.exec(reference);
    if (!match) return null;

    const [, bookName, chapter, verse] = match;
    if (!bookName || !chapter || !verse) return null;

    const book = BIBLE_BOOKS.find(b =>
        b.name.toLowerCase() === bookName.toLowerCase() ||
        b.id === bookName.toLowerCase()
    );

    if (!book) return null;

    return {
        book: book.id,
        chapter: parseInt(chapter),
        verse: parseInt(verse)
    };
}; 