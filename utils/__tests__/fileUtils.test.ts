/// <reference types="jest" />

jest.mock('expo-file-system', () => ({
  Directory: class Directory {},
  File: class File {},
  Paths: {
    document: { uri: 'file:///docs' },
    cache: { uri: 'file:///cache' }
  }
}));

import {
  getDirectory,
  getFileName,
  getLocalFilePathSuffix,
  getLocalUri,
  normalizeFileUri,
  stringToArrayBuffer
} from '../fileUtils';

describe('getFileName', () => {
  it('returns the last path segment', () => {
    expect(getFileName('/path/to/file.txt')).toBe('file.txt');
    expect(getFileName('file.txt')).toBe('file.txt');
    expect(getFileName('file:///docs/shared_attachments/a.m4a')).toBe('a.m4a');
  });
});

describe('getDirectory', () => {
  it('returns the parent of a file:// URI', () => {
    expect(getDirectory('file:///path/to/file.txt')).toBe('file:///path/to');
    expect(getDirectory('file:///file.txt')).toBe('file:///');
  });

  it('returns the parent of an absolute path', () => {
    expect(getDirectory('/path/to/file.txt')).toBe('path/to');
    expect(getDirectory('/file.txt')).toBe('');
  });
});

describe('normalizeFileUri', () => {
  it('normalizes file:// variants and strips traversal', () => {
    expect(normalizeFileUri('file://tmp/a.m4a')).toBe('file:///tmp/a.m4a');
    expect(normalizeFileUri('file:///tmp/../a.m4a')).toBe('file:///tmp/a.m4a');
    expect(normalizeFileUri('file:///tmp/a.m4a/')).toBe('file:///tmp/a.m4a');
  });

  it('cleans non-file paths', () => {
    expect(normalizeFileUri('/tmp/../a.m4a')).toBe('/tmp/a.m4a');
    expect(normalizeFileUri('/tmp//a.m4a/')).toBe('/tmp/a.m4a');
  });
});

describe('getLocalUri and getLocalFilePathSuffix', () => {
  it('joins the document directory with a relative path', () => {
    expect(getLocalFilePathSuffix('a.m4a')).toBe('shared_attachments/a.m4a');
    expect(getLocalUri('shared_attachments/a.m4a')).toBe(
      'file:///docs/shared_attachments/a.m4a'
    );
    expect(getLocalUri('/shared_attachments/a.m4a')).toBe(
      'file:///docs/shared_attachments/a.m4a'
    );
  });
});

describe('stringToArrayBuffer', () => {
  it('encodes UTF-8 bytes', () => {
    const buffer = stringToArrayBuffer('ab');
    expect(Array.from(new Uint8Array(buffer))).toEqual([97, 98]);
  });
});
