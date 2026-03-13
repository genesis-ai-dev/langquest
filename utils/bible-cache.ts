import type { BibleBrainContentResponse } from '@/hooks/useBibleBrainContent';

import {
  deleteIfExists,
  downloadFile,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  readTextFile,
  writeFile
} from './fileUtils';

const BIBLE_CACHE_DIR = 'bible_cache';

function getBaseDir(): string {
  return `${getDocumentDirectory()}${BIBLE_CACHE_DIR}`;
}

/**
 * Create a nested directory path one level at a time.
 * `ensureDir` only creates a single level, so we walk each segment.
 */
function ensureNestedDir(base: string, subPath: string) {
  ensureDir(base);
  const parts = subPath.split('/').filter(Boolean);
  let current = base;
  for (const part of parts) {
    current = `${current}/${part}`;
    ensureDir(current);
  }
}

/**
 * Directory structure: bible_cache/{filesetId}/{bookId}/{chapterRange}/
 * e.g. bible_cache/ENGKJV2DA/MRK/1_1-1_13/
 */
function getPassageCacheDir(
  filesetId: string,
  bookId: string,
  verseRange: string
): string {
  const safeRange = verseRange.replace(/[:/]/g, '_');
  return `${getBaseDir()}/${filesetId}/${bookId}/${safeRange}`;
}

function getTextJsonPath(
  filesetId: string,
  bookId: string,
  verseRange: string
): string {
  return `${getPassageCacheDir(filesetId, bookId, verseRange)}/text.json`;
}

function getAudioManifestPath(
  audioFilesetId: string,
  bookId: string,
  verseRange: string
): string {
  return `${getPassageCacheDir(audioFilesetId, bookId, verseRange)}/audio.json`;
}

// --- Text caching (auto, small files) ---

export async function cacheBibleText(
  textFilesetId: string,
  bookId: string,
  verseRange: string,
  data: BibleBrainContentResponse
): Promise<void> {
  const textOnly = { verses: data.verses, audio: [] };
  const safeRange = verseRange.replace(/[:/]/g, '_');
  ensureNestedDir(getBaseDir(), `${textFilesetId}/${bookId}/${safeRange}`);
  writeFile(getTextJsonPath(textFilesetId, bookId, verseRange), JSON.stringify(textOnly));
}

export async function getCachedBibleText(
  textFilesetId: string,
  bookId: string,
  verseRange: string
): Promise<BibleBrainContentResponse | null> {
  const path = getTextJsonPath(textFilesetId, bookId, verseRange);
  if (!fileExists(path)) return null;
  return JSON.parse(await readTextFile(path)) as BibleBrainContentResponse;
}

// --- Audio caching (user-initiated, larger files) ---

export interface BibleAudioCacheManifest {
  chapters: Array<{
    chapter: number;
    localUri: string;
    duration: number;
    timestamps?: Array<{ verseStart: number; timestamp: number }>;
  }>;
  cachedAt: number;
}

export async function downloadBibleAudio(
  audioFilesetId: string,
  bookId: string,
  verseRange: string,
  audioChapters: BibleBrainContentResponse['audio'],
  onProgress?: (downloaded: number, total: number) => void
): Promise<BibleAudioCacheManifest> {
  const safeRange = verseRange.replace(/[:/]/g, '_');
  ensureNestedDir(getBaseDir(), `${audioFilesetId}/${bookId}/${safeRange}/audio`);
  const dir = getPassageCacheDir(audioFilesetId, bookId, verseRange);
  const audioDir = `${dir}/audio`;

  const total = audioChapters.length;
  const manifest: BibleAudioCacheManifest = {
    chapters: [],
    cachedAt: Date.now()
  };

  for (let i = 0; i < audioChapters.length; i++) {
    const chapter = audioChapters[i]!;
    const filename = `chapter_${chapter.chapter}.mp3`;
    const localUri = await downloadFile(chapter.url, audioDir, filename);

    manifest.chapters.push({
      chapter: chapter.chapter,
      localUri,
      duration: chapter.duration,
      timestamps: chapter.timestamps
    });

    onProgress?.(i + 1, total);
  }

  writeFile(
    getAudioManifestPath(audioFilesetId, bookId, verseRange),
    JSON.stringify(manifest)
  );

  return manifest;
}

export async function getCachedBibleAudio(
  audioFilesetId: string,
  bookId: string,
  verseRange: string
): Promise<BibleAudioCacheManifest | null> {
  const path = getAudioManifestPath(audioFilesetId, bookId, verseRange);
  if (!fileExists(path)) return null;
  try {
    return JSON.parse(await readTextFile(path)) as BibleAudioCacheManifest;
  } catch {
    return null;
  }
}

export function isBibleAudioCached(
  audioFilesetId: string,
  bookId: string,
  verseRange: string
): boolean {
  return fileExists(getAudioManifestPath(audioFilesetId, bookId, verseRange));
}

export function deleteBiblePassageCache(
  filesetId: string,
  bookId: string,
  verseRange: string
): void {
  deleteIfExists(getPassageCacheDir(filesetId, bookId, verseRange));
}

export function clearAllBibleCache(): void {
  deleteIfExists(getBaseDir());
}

/**
 * Check if text is cached for a given fileset + passage.
 * Used to show offline indicators in the translation picker.
 */
export function isBibleTextCached(
  textFilesetId: string,
  bookId: string,
  verseRange: string
): boolean {
  return fileExists(getTextJsonPath(textFilesetId, bookId, verseRange));
}
