/// <reference types="jest" />

// In-memory "mockDisk": full URIs of files that exist.
const mockDisk = new Set<string>();
const mockMoves: [string, string][] = [];
const mockDeleted: string[] = [];
let mockFailMoveFor: string | null = null;

const MOCK_ROOT = 'file:///docs/shared_attachments';

jest.mock('@/utils/fileUtils', () => ({
  SHARED_ATTACHMENTS_DIRECTORY: 'shared_attachments',
  getLocalUri: (filePath: string) => `file:///docs/${filePath}`,
  getLocalAttachmentUri: (filePath: string) => `${MOCK_ROOT}/${filePath}`,
  ensureDir: () => undefined,
  fileExists: (uri: string) => mockDisk.has(uri),
  listDirectoryFilenames: (dirUri: string) => {
    const prefix = dirUri.endsWith('/') ? dirUri : `${dirUri}/`;
    return Promise.resolve(
      [...mockDisk]
        .filter((uri) => uri.startsWith(prefix))
        .map((uri) => uri.slice(prefix.length))
        .filter((rest) => !rest.includes('/'))
    );
  },
  moveFile: (from: string, to: string) => {
    if (mockFailMoveFor && from.endsWith(mockFailMoveFor)) {
      throw new Error(`boom: ${from}`);
    }
    mockDisk.delete(from);
    mockDisk.add(to);
    mockMoves.push([from, to]);
  },
  deleteIfExists: (uri: string) => {
    mockDisk.delete(uri);
    mockDeleted.push(uri);
  }
}));

import { migrateLegacyLocalAudioDirectory } from '../migrateLegacyLocalAudio';

describe('migrateLegacyLocalAudioDirectory', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockMoves.length = 0;
    mockDeleted.length = 0;
    mockFailMoveFor = null;
  });

  it('is a no-op when there is no legacy folder', async () => {
    mockDisk.add(`${MOCK_ROOT}/a.m4a`);
    await expect(migrateLegacyLocalAudioDirectory()).resolves.toEqual({
      moved: 0,
      duplicates: 0,
      failed: 0
    });
    expect(mockMoves).toEqual([]);
    expect(mockDeleted).toEqual([]);
  });

  it('mockMoves every local/ file to the root and removes the folder', async () => {
    mockDisk.add(`${MOCK_ROOT}/local/a.m4a`);
    mockDisk.add(`${MOCK_ROOT}/local/b.m4a`);

    await expect(migrateLegacyLocalAudioDirectory()).resolves.toEqual({
      moved: 2,
      duplicates: 0,
      failed: 0
    });
    expect(mockDisk.has(`${MOCK_ROOT}/a.m4a`)).toBe(true);
    expect(mockDisk.has(`${MOCK_ROOT}/b.m4a`)).toBe(true);
    expect(mockDisk.has(`${MOCK_ROOT}/local/a.m4a`)).toBe(false);
    expect(mockDeleted).toContain(`${MOCK_ROOT}/local/`);
  });

  it('drops a local/ copy when the same file already exists at the root', async () => {
    mockDisk.add(`${MOCK_ROOT}/a.m4a`);
    mockDisk.add(`${MOCK_ROOT}/local/a.m4a`);

    await expect(migrateLegacyLocalAudioDirectory()).resolves.toEqual({
      moved: 0,
      duplicates: 1,
      failed: 0
    });
    expect(mockMoves).toEqual([]);
    expect(mockDisk.has(`${MOCK_ROOT}/a.m4a`)).toBe(true);
    expect(mockDisk.has(`${MOCK_ROOT}/local/a.m4a`)).toBe(false);
  });

  it('leaves a file that fails to move in place and keeps the folder', async () => {
    mockDisk.add(`${MOCK_ROOT}/local/a.m4a`);
    mockDisk.add(`${MOCK_ROOT}/local/bad.m4a`);
    mockFailMoveFor = 'bad.m4a';

    await expect(migrateLegacyLocalAudioDirectory()).resolves.toEqual({
      moved: 1,
      duplicates: 0,
      failed: 1
    });
    expect(mockDisk.has(`${MOCK_ROOT}/a.m4a`)).toBe(true);
    expect(mockDisk.has(`${MOCK_ROOT}/local/bad.m4a`)).toBe(true);
    expect(mockDeleted).not.toContain(`${MOCK_ROOT}/local/`);
  });
});
