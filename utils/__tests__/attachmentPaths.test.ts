/// <reference types="jest" />

const mockExisting = new Set<string>();

jest.mock('@/utils/fileUtils', () => ({
  fileExists: (uri: string) => mockExisting.has(uri),
  getFileName: (uri: string) => uri.split('/').pop(),
  getLocalAttachmentUri: (filePath: string) =>
    `file:///docs/shared_attachments/${filePath}`,
  getLocalAttachmentUriWithOPFS: (filePath: string) =>
    `file:///docs/shared_attachments/${filePath}`
}));

import {
  isRemoteAudioObject,
  localAudioFileName,
  normalizeStoredAudioArray,
  resolveExistingAudioUri,
  storageAudioObjectName
} from '../attachmentPaths';

describe('attachmentPaths', () => {
  beforeEach(() => mockExisting.clear());

  describe('localAudioFileName', () => {
    it('is the value itself for a modern object name', () => {
      expect(localAudioFileName('abc.m4a')).toBe('abc.m4a');
    });

    it('strips the legacy local/ prefix', () => {
      expect(localAudioFileName('local/abc.m4a')).toBe('abc.m4a');
    });

    it('takes the basename of a legacy file:// URI', () => {
      expect(localAudioFileName('file:///var/tmp/abc.m4a')).toBe('abc.m4a');
    });
  });

  describe('storageAudioObjectName', () => {
    it('only strips local/', () => {
      expect(storageAudioObjectName('local/abc.m4a')).toBe('abc.m4a');
      expect(storageAudioObjectName('abc.m4a')).toBe('abc.m4a');
      expect(storageAudioObjectName('file:///x/abc.m4a')).toBe(
        'file:///x/abc.m4a'
      );
    });
  });

  describe('normalizeStoredAudioArray', () => {
    it('strips local/ from every element and rejects non-arrays', () => {
      expect(normalizeStoredAudioArray(['local/a.m4a', 'b.m4a'])).toEqual([
        'a.m4a',
        'b.m4a'
      ]);
      expect(normalizeStoredAudioArray('a.m4a')).toBeNull();
      expect(normalizeStoredAudioArray(null)).toBeNull();
    });
  });

  describe('isRemoteAudioObject', () => {
    it('accepts object names (including legacy local/) and rejects junk', () => {
      expect(isRemoteAudioObject('a.m4a')).toBe(true);
      expect(isRemoteAudioObject('local/a.m4a')).toBe(true);
      expect(isRemoteAudioObject('file:///a.m4a')).toBe(false);
      expect(isRemoteAudioObject('blob:http://x/y')).toBe(false);
      expect(isRemoteAudioObject('  ')).toBe(false);
    });
  });

  describe('resolveExistingAudioUri', () => {
    it('finds a modern value at the flat location', async () => {
      mockExisting.add('file:///docs/shared_attachments/a.m4a');
      await expect(resolveExistingAudioUri('a.m4a')).resolves.toBe(
        'file:///docs/shared_attachments/a.m4a'
      );
    });

    it('finds a legacy local/ value at the flat location after migration', async () => {
      mockExisting.add('file:///docs/shared_attachments/a.m4a');
      await expect(resolveExistingAudioUri('local/a.m4a')).resolves.toBe(
        'file:///docs/shared_attachments/a.m4a'
      );
    });

    it('falls back to the legacy local/ folder when the move did not happen', async () => {
      mockExisting.add('file:///docs/shared_attachments/local/a.m4a');
      await expect(resolveExistingAudioUri('a.m4a')).resolves.toBe(
        'file:///docs/shared_attachments/local/a.m4a'
      );
    });

    it('resolves a legacy file:// value by its basename when the URI is gone', async () => {
      mockExisting.add('file:///docs/shared_attachments/a.m4a');
      await expect(
        resolveExistingAudioUri('file:///old/cache/a.m4a')
      ).resolves.toBe('file:///docs/shared_attachments/a.m4a');
    });

    it('returns null for missing files and invalid values', async () => {
      await expect(resolveExistingAudioUri('a.m4a')).resolves.toBeNull();
      await expect(
        resolveExistingAudioUri('blob:http://x/y')
      ).resolves.toBeNull();
      await expect(resolveExistingAudioUri('')).resolves.toBeNull();
    });
  });
});
