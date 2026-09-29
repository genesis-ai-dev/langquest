/// <reference types="jest" />

import {
  extractFiaMetadata,
  getBibleBookIdFromFia,
  getFiaSequenceFromQuestMetadata,
  parseFiaVerseRange
} from '../fiaUtils';

describe('getBibleBookIdFromFia', () => {
  it('maps FIA abbreviations onto Bible book ids', () => {
    expect(getBibleBookIdFromFia('mrk')).toBe('mar');
    expect(getBibleBookIdFromFia('php')).toBe('phi');
    expect(getBibleBookIdFromFia('jol')).toBe('joe');
    expect(getBibleBookIdFromFia('nam')).toBe('nah');
  });

  it('passes through unknown ids', () => {
    expect(getBibleBookIdFromFia('gen')).toBe('gen');
  });
});

describe('parseFiaVerseRange', () => {
  it('parses a same-chapter range', () => {
    expect(parseFiaVerseRange('1:1-8')).toEqual({
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 8
    });
  });

  it('parses a cross-chapter range and optional verse letters', () => {
    expect(parseFiaVerseRange('1:16a-2:4b')).toEqual({
      startChapter: 1,
      startVerse: 16,
      endChapter: 2,
      endVerse: 4
    });
  });

  it('returns null for invalid strings', () => {
    expect(parseFiaVerseRange('Genesis 1')).toBeNull();
    expect(parseFiaVerseRange('1-8')).toBeNull();
    expect(parseFiaVerseRange('')).toBeNull();
  });
});

describe('extractFiaMetadata', () => {
  it('reads a fia block from an object or JSON string', () => {
    const fia = { bookId: 'mrk', verseRange: '1:1-8' };
    expect(extractFiaMetadata({ fia })).toEqual(fia);
    expect(extractFiaMetadata(JSON.stringify({ fia }))).toEqual(fia);
  });

  it('ignores missing or invalid fia blocks', () => {
    expect(extractFiaMetadata(null)).toBeNull();
    expect(extractFiaMetadata('not-json')).toBeNull();
    expect(extractFiaMetadata([])).toBeNull();
    expect(extractFiaMetadata({ fia: 'mrk' })).toBeNull();
    expect(extractFiaMetadata({ fia: { bookId: 1, verseRange: 2 } })).toEqual({
      bookId: undefined,
      verseRange: undefined
    });
  });
});

describe('getFiaSequenceFromQuestMetadata', () => {
  it('builds a verse sequence for a mapped FIA book', () => {
    const sequence = getFiaSequenceFromQuestMetadata({
      fia: { bookId: 'mrk', verseRange: '1:1-3' }
    });
    expect(sequence).toEqual([
      { chapter: 1, verse: 1 },
      { chapter: 1, verse: 2 },
      { chapter: 1, verse: 3 }
    ]);
  });

  it('returns null when the range or book is unusable', () => {
    expect(
      getFiaSequenceFromQuestMetadata({
        fia: { bookId: 'mrk', verseRange: 'nope' }
      })
    ).toBeNull();
    expect(
      getFiaSequenceFromQuestMetadata({
        fia: { bookId: 'zzz', verseRange: '1:1-3' }
      })
    ).toBeNull();
    expect(
      getFiaSequenceFromQuestMetadata({ fia: { bookId: 'mrk' } })
    ).toBeNull();
  });
});
