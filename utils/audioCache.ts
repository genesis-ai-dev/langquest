import { useLocalStore } from '@/store/localStore';
import {
  deleteIfExists,
  downloadFile,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  getFileSize
} from '@/utils/fileUtils';

const CACHE_DIR_NAME = 'audio_cache';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365; // 1 year

let cacheDirUri: string | null = null;

function getCacheDirUri(): string {
  if (!cacheDirUri) {
    cacheDirUri = `${getDocumentDirectory()}/${CACHE_DIR_NAME}`;
    ensureDir(cacheDirUri);
  }
  return cacheDirUri;
}

function cachedFilePath(filename: string): string {
  return `${getCacheDirUri()}/${filename}`;
}

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const tail = url.length > 32 ? url.slice(-32) : url;
  const safeTail = tail.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${hex}_${safeTail}`;
}

function extractExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf('.');
    if (dot !== -1) {
      const ext = pathname.slice(dot).split(/[?#]/)[0];
      if (ext && ext.length <= 6) return ext;
    }
  } catch {
    // Malformed URL
  }
  return '.mp3';
}

/**
 * Returns a local file URI for the given remote audio URL.
 * Downloads and caches the file if not already present or expired.
 * Returns the original URL if download fails (graceful fallback).
 */
export async function getCachedAudioUri(remoteUrl: string): Promise<string> {
  if (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://')) {
    return remoteUrl;
  }

  const store = useLocalStore.getState();
  const existing = store.audioCacheEntries[remoteUrl];

  if (existing && Date.now() - existing.downloadedAt <= CACHE_TTL_MS) {
    const path = cachedFilePath(existing.filename);
    if (fileExists(path)) {
      return path;
    }
  }

  const extension = extractExtension(remoteUrl);
  const filename = `${hashUrl(remoteUrl)}${extension}`;
  const destPath = cachedFilePath(filename);

  try {
    await downloadFile(remoteUrl, destPath);

    store.setAudioCacheEntry(remoteUrl, {
      filename,
      downloadedAt: Date.now()
    });

    return destPath;
  } catch (error) {
    console.warn(
      '[AudioCache] Download failed, falling back to remote URL:',
      error
    );
    return remoteUrl;
  }
}

/**
 * Removes cached entries older than 1 year and deletes their files.
 * Safe to call at any time.
 */
export function expireAudioCache(): void {
  const store = useLocalStore.getState();
  const entries = store.audioCacheEntries;
  const now = Date.now();
  const expired: string[] = [];

  for (const [url, entry] of Object.entries(entries)) {
    if (now - entry.downloadedAt > CACHE_TTL_MS) {
      deleteIfExists(cachedFilePath(entry.filename));
      expired.push(url);
    }
  }

  if (expired.length > 0) {
    store.removeAudioCacheEntries(expired);
    console.log(`[AudioCache] Expired ${expired.length} cached audio file(s)`);
  }
}

/**
 * Returns the number of entries and approximate disk usage of the audio cache.
 */
export function getAudioCacheStats(): { count: number; sizeBytes: number } {
  const entries = useLocalStore.getState().audioCacheEntries;
  let totalSize = 0;

  for (const entry of Object.values(entries)) {
    totalSize += getFileSize(cachedFilePath(entry.filename));
  }

  return { count: Object.keys(entries).length, sizeBytes: totalSize };
}

/**
 * Removes all cached audio files and resets the manifest.
 */
export function clearAudioCache(): void {
  const store = useLocalStore.getState();

  for (const entry of Object.values(store.audioCacheEntries)) {
    deleteIfExists(cachedFilePath(entry.filename));
  }

  store.clearAudioCacheEntries();
  console.log('[AudioCache] Cache cleared');
}
