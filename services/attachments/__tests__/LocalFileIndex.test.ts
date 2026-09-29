/// <reference types="jest" />

jest.mock('@/utils/fileUtils', () => ({
  SHARED_ATTACHMENTS_DIRECTORY: 'shared_attachments',
  getLocalUri: (filePath: string) => `file:///docs/${filePath}`,
  listDirectoryFilenames: jest.fn(async () => [])
}));

jest.mock('../migrateLegacyLocalAudio', () => ({
  migrateLegacyLocalAudioDirectory: jest.fn(async () => ({
    moved: 0,
    duplicates: 0,
    failed: 0
  }))
}));

import { listDirectoryFilenames } from '@/utils/fileUtils';
import { migrateLegacyLocalAudioDirectory } from '../migrateLegacyLocalAudio';
import { LocalFileIndex } from '../LocalFileIndex';

const listFiles = listDirectoryFilenames as jest.MockedFunction<
  typeof listDirectoryFilenames
>;
const migrateLegacy = migrateLegacyLocalAudioDirectory as jest.MockedFunction<
  typeof migrateLegacyLocalAudioDirectory
>;

describe('LocalFileIndex', () => {
  beforeEach(() => {
    listFiles.mockReset();
    listFiles.mockResolvedValue([]);
    migrateLegacy.mockReset();
    migrateLegacy.mockResolvedValue({
      moved: 0,
      duplicates: 0,
      failed: 0
    });
  });

  it('add is idempotent and subscribe notifies on new names', () => {
    const index = new LocalFileIndex();
    const listener = jest.fn();
    const unsubscribe = index.subscribe(listener);

    index.add('a.m4a');
    index.add('a.m4a');
    expect(index.has('a.m4a')).toBe(true);
    expect(index.size).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    index.add('b.m4a');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps notifying after a listener throws', () => {
    const index = new LocalFileIndex();
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const good = jest.fn();
    index.subscribe(() => {
      throw new Error('listener boom');
    });
    index.subscribe(good);

    index.add('a.m4a');
    expect(good).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('init scans once and records on-disk files', async () => {
    listFiles.mockResolvedValue(['a.m4a', 'b.wav']);
    const index = new LocalFileIndex();
    const listener = jest.fn();
    index.subscribe(listener);

    await Promise.all([index.init(), index.init()]);

    expect(migrateLegacy).toHaveBeenCalledTimes(1);
    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(index.has('a.m4a')).toBe(true);
    expect(index.has('b.wav')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('continues scanning when legacy migration fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    migrateLegacy.mockRejectedValue(new Error('io'));
    listFiles.mockResolvedValue(['kept.m4a']);

    const index = new LocalFileIndex();
    await index.init();
    expect(index.has('kept.m4a')).toBe(true);
    warn.mockRestore();
  });
});
