/// <reference types="jest" />

import {
    ensureUniqueFileNames,
    formatCurrentDateTime,
    getFIAVerseSuffix,
    getMetadataVerseForCsv,
    getMetadataVerseForFiaCsv,
    getMimeTypeFromFileName,
    getUniqueFileName,
    getVerseSuffix,
    isUserCancellationError,
    parseMetadata,
    parseVersePosition,
    sanitizeNamePart
} from '../exportNaming';

describe('sanitizeNamePart', () => {
  it('strips illegal characters and collapses dashes', () => {
    expect(sanitizeNamePart('  Genesis 1  ')).toBe('Genesis-1');
    expect(sanitizeNamePart('a<>:"/\\|?*b')).toBe('ab');
    expect(sanitizeNamePart('foo   --  bar')).toBe('foo-bar');
  });

  it('falls back to asset for blank input', () => {
    expect(sanitizeNamePart('')).toBe('asset');
    expect(sanitizeNamePart('   ')).toBe('asset');
  });
});

describe('getUniqueFileName', () => {
  it('returns the original name when it is free', () => {
    expect(getUniqueFileName('take.m4a', new Set())).toBe('take.m4a');
  });

  it('adds (2), (3) suffixes on collision', () => {
    const existing = new Set(['take.m4a', 'take (2).m4a']);
    expect(getUniqueFileName('take.m4a', existing)).toBe('take (3).m4a');
  });

  it('handles names without an extension', () => {
    expect(getUniqueFileName('notes', new Set(['notes']))).toBe('notes (2)');
  });
});

describe('getMimeTypeFromFileName', () => {
  it('maps audio extensions and falls back for unknown types', () => {
    expect(getMimeTypeFromFileName('a.m4a')).toBe('audio/mp4');
    expect(getMimeTypeFromFileName('a.MP4')).toBe('audio/mp4');
    expect(getMimeTypeFromFileName('a.wav')).toBe('audio/wav');
    expect(getMimeTypeFromFileName('a.mp3')).toBe('audio/mpeg');
    expect(getMimeTypeFromFileName('a.aac')).toBe('audio/aac');
    expect(getMimeTypeFromFileName('a.bin')).toBe('application/octet-stream');
  });
});

describe('parseMetadata', () => {
  it('parses objects and JSON objects', () => {
    expect(parseMetadata({ verse: { from: 1, to: 2 } })).toEqual({
      verse: { from: 1, to: 2 }
    });
    expect(parseMetadata('{"verse":{"from":1,"to":2}}')).toEqual({
      verse: { from: 1, to: 2 }
    });
  });

  it('returns null for missing or invalid values', () => {
    expect(parseMetadata(null)).toBeNull();
    expect(parseMetadata('not-json')).toBeNull();
    expect(parseMetadata('["array"]')).toBeNull();
  });
});

describe('getVerseSuffix', () => {
  it('builds a vfrom-to suffix', () => {
    expect(getVerseSuffix({ verse: { from: 1, to: 8 } })).toBe('v1-8');
    expect(getVerseSuffix({ verse: { from: '2', to: '3' } })).toBe('v2-3');
  });

  it('returns null without a complete verse range', () => {
    expect(getVerseSuffix({})).toBeNull();
    expect(getVerseSuffix({ verse: { from: 1 } })).toBeNull();
    expect(getVerseSuffix({ verse: { from: true, to: 2 } })).toBeNull();
  });
});

describe('getFIAVerseSuffix', () => {
  const sequence = [
    { chapter: 1, verse: 1 },
    { chapter: 1, verse: 2 },
    { chapter: 1, verse: 3 }
  ];

  it('maps 1-based positions onto the pericope sequence', () => {
    expect(getFIAVerseSuffix({ verse: { from: 1, to: 3 } }, sequence)).toBe(
      'v11-13'
    );
    expect(getFIAVerseSuffix({ verse: { from: 2, to: 2 } }, sequence)).toBe(
      'v12'
    );
  });

  it('falls back to a generic suffix when the sequence is empty', () => {
    expect(getFIAVerseSuffix({ verse: { from: 1, to: 2 } }, [])).toBe('v1-2');
    expect(getFIAVerseSuffix({ verse: { from: 1, to: 2 } }, null)).toBe('v1-2');
  });
});

describe('ensureUniqueFileNames', () => {
  it('renames later duplicates in a batch', () => {
    const files = [
      { uri: 'a', name: 'take.m4a', mimeType: 'audio/mp4' },
      { uri: 'b', name: 'take.m4a', mimeType: 'audio/mp4' },
      { uri: 'c', name: 'other.wav', mimeType: 'audio/wav' }
    ];
    expect(ensureUniqueFileNames(files).map((file) => file.name)).toEqual([
      'take.m4a',
      'take (2).m4a',
      'other.wav'
    ]);
  });
});

describe('isUserCancellationError', () => {
  it('detects cancel/abort messages and ignores other errors', () => {
    expect(isUserCancellationError(new Error('User cancelled'))).toBe(true);
    expect(isUserCancellationError(new Error('canceled'))).toBe(true);
    expect(isUserCancellationError(new Error('aborted'))).toBe(true);
    expect(isUserCancellationError(new Error('disk full'))).toBe(false);
    expect(isUserCancellationError('cancel')).toBe(false);
  });
});

describe('csv verse helpers', () => {
  it('formats bible and FIA CSV verse cells', () => {
    expect(getMetadataVerseForCsv({ verse: { from: 1, to: 3 } })).toBe('v1-3');
    expect(getMetadataVerseForCsv({ verse: 12 })).toBe('12');
    expect(
      getMetadataVerseForFiaCsv({ verse: { from: 1, to: 2 } }, [
        { chapter: 3, verse: 1 },
        { chapter: 3, verse: 2 }
      ])
    ).toBe('3:1-3:2');
  });

  it('parses verse positions', () => {
    expect(parseVersePosition(3.9)).toBe(3);
    expect(parseVersePosition('8')).toBe(8);
    expect(parseVersePosition('nope')).toBeNull();
    expect(parseVersePosition(true)).toBeNull();
  });
});

describe('formatCurrentDateTime', () => {
  it('formats a local timestamp as YYYYMMDD-HHMMSS', () => {
    const date = new Date(2026, 8, 18, 9, 5, 7);
    expect(formatCurrentDateTime(date)).toBe('20260918-090507');
  });
});
