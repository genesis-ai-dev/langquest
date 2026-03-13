import type { FiaPericopeStepsResponse } from '@/hooks/useFiaPericopeSteps';

import {
  deleteIfExists,
  downloadFile,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  readTextFile,
  writeFile
} from './fileUtils';
import {
  lookupFiaLanguageCode,
  lookupSourceLanguoidId
} from './languoidLookups';

const FIA_CACHE_DIR = 'fia_attachments';

function getCacheDir(pericopeId: string): string {
  const parts = pericopeId.split('-');
  return `${getDocumentDirectory()}${FIA_CACHE_DIR}/${parts.join('/')}`;
}

function getResponseJsonPath(pericopeId: string): string {
  return `${getCacheDir(pericopeId)}/response.json`;
}

function collectMediaUrls(data: FiaPericopeStepsResponse): string[] {
  const set = new Set<string>();

  for (const step of data.steps) {
    if (step.audioUrl) set.add(step.audioUrl);
  }
  for (const item of data.mediaItems) {
    for (const asset of item.assets) {
      if (asset.imageUrl) set.add(asset.imageUrl);
    }
  }
  for (const map of data.maps) {
    if (map.imageUrl) set.add(map.imageUrl);
  }

  return [...set];
}

function localSubpath(url: string): { subDir: string; filename: string } {
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean);
  const filename = parts.pop() ?? 'file';
  // Skip the S3 bucket name (e.g. "cbbt-er.public")
  const subDir = parts.slice(1).join('/');
  return { subDir, filename };
}

function ensureNestedDir(base: string, subPath: string) {
  const parts = subPath.split('/').filter(Boolean);
  let current = base;
  for (const part of parts) {
    current = `${current}/${part}`;
    ensureDir(current);
  }
}

function rewriteUrls(
  data: FiaPericopeStepsResponse,
  urlMap: Map<string, string>
): FiaPericopeStepsResponse {
  const rewritten = JSON.parse(
    JSON.stringify(data)
  ) as FiaPericopeStepsResponse;

  for (const step of rewritten.steps) {
    if (step.audioUrl && urlMap.has(step.audioUrl)) {
      step.audioUrl = urlMap.get(step.audioUrl)!;
    }
  }
  for (const item of rewritten.mediaItems) {
    for (const asset of item.assets) {
      if (asset.imageUrl && urlMap.has(asset.imageUrl)) {
        asset.imageUrl = urlMap.get(asset.imageUrl)!;
      }
    }
  }
  for (const map of rewritten.maps) {
    if (map.imageUrl && urlMap.has(map.imageUrl)) {
      map.imageUrl = urlMap.get(map.imageUrl)!;
    }
  }

  return rewritten;
}

export async function fetchAndCacheFiaPericope(
  projectId: string,
  pericopeId: string,
  accessToken: string | undefined
): Promise<void> {
  // Clean up any partial cache from a previous failed attempt
  deleteIfExists(getCacheDir(pericopeId));

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
  if (!sourceLanguoidId) {
    throw new Error('Could not find source languoid for project');
  }

  const fiaCode = await lookupFiaLanguageCode(sourceLanguoidId);
  if (!fiaCode) {
    throw new Error(
      `No FIA language code found for languoid ${sourceLanguoidId}`
    );
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/fia-pericope-steps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ pericopeId, fiaLanguageCode: fiaCode })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `FIA pericope steps fetch failed (${response.status}): ${errorText}`
    );
  }

  const data: FiaPericopeStepsResponse = await response.json();

  const cacheDir = getCacheDir(pericopeId);
  const baseDir = `${getDocumentDirectory()}${FIA_CACHE_DIR}`;
  ensureNestedDir(baseDir, pericopeId.split('-').join('/'));
  const urls = collectMediaUrls(data);
  const urlMap = new Map<string, string>();

  await Promise.all(
    urls.map(async (url) => {
      const { subDir, filename } = localSubpath(url);
      ensureNestedDir(cacheDir, subDir);
      const destDir = subDir ? `${cacheDir}/${subDir}` : cacheDir;
      const localUri = await downloadFile(url, destDir, filename);
      urlMap.set(url, localUri);
    })
  );

  // response.json is written last — its presence signals a complete cache
  const rewritten = rewriteUrls(data, urlMap);
  writeFile(getResponseJsonPath(pericopeId), JSON.stringify(rewritten));
}

export function isFiaPericopeCached(pericopeId: string): boolean {
  return fileExists(getResponseJsonPath(pericopeId));
}

export async function getCachedFiaPericope(
  pericopeId: string
): Promise<FiaPericopeStepsResponse | null> {
  const path = getResponseJsonPath(pericopeId);
  console.log('[FIA Cache] Looking for:', path, 'exists:', fileExists(path));
  if (!fileExists(path)) return null;
  return JSON.parse(await readTextFile(path)) as FiaPericopeStepsResponse;
}

export function deleteFiaPericopeCache(pericopeId: string): void {
  deleteIfExists(getCacheDir(pericopeId));
}

export function clearAllFiaCache(): void {
  deleteIfExists(`${getDocumentDirectory()}${FIA_CACHE_DIR}`);
}
