/**
 * Background download queue for FIA pericope content and images.
 * Singleton service that processes queued pericopes: fetches steps data from
 * the edge function, downloads all referenced images to the local filesystem,
 * and persists the response for offline use.
 *
 * State is tracked in the local store so the AppDrawer can display progress.
 */

import { system } from '@/db/powersync/system';
import type { FiaPericopeStepsResponse } from '@/hooks/useFiaPericopeSteps';
import type { FiaAttachmentQueueItem } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { useShallow } from 'zustand/react/shallow';
import {
  downloadFile,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  readFileText,
  writeFile
} from '@/utils/fileUtils';
import {
  lookupFiaLanguageCode,
  lookupSourceLanguoidId
} from '@/utils/languoidLookups';

const FIA_DIR = 'fia_attachments';
const IMAGES_DIR = `${FIA_DIR}/images`;

function pericopeDataPath(pericopeId: string): string {
  return `${getDocumentDirectory()}/${FIA_DIR}/${pericopeId}/response.json`;
}

function imageCachePath(url: string): string {
  const hash = stableHash(url);
  const ext = imageExt(url);
  return `${getDocumentDirectory()}/${IMAGES_DIR}/${hash}.${ext}`;
}

function stableHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function imageExt(url: string): string {
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
      return ext;
  } catch {
    /* ignore */
  }
  return 'jpg';
}

function extractImageUrls(data: FiaPericopeStepsResponse): string[] {
  const urls: string[] = [];
  for (const item of data.mediaItems) {
    for (const asset of item.assets) {
      if (asset.imageUrl) urls.push(asset.imageUrl);
    }
  }
  for (const map of data.maps) {
    if (map.imageUrl) urls.push(map.imageUrl);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Public cache access (used by hooks and components)
// ---------------------------------------------------------------------------

export function isFiaPericopeCached(pericopeId: string): boolean {
  return fileExists(pericopeDataPath(pericopeId));
}

export function getCachedFiaPericope(
  pericopeId: string
): FiaPericopeStepsResponse | null {
  const path = pericopeDataPath(pericopeId);
  if (!fileExists(path)) return null;
  try {
    return JSON.parse(readFileText(path)) as FiaPericopeStepsResponse;
  } catch (e) {
    console.error('[FiaAttachmentQueue] Failed to read cached pericope:', e);
    return null;
  }
}

export function getCachedImageUri(remoteUrl: string): string | null {
  const path = imageCachePath(remoteUrl);
  return fileExists(path) ? path : null;
}

export function resolveImageUri(remoteUrl: string): string {
  return getCachedImageUri(remoteUrl) ?? remoteUrl;
}

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------

const RETRY_DELAY_MS = 30_000;
const FETCH_TIMEOUT_MS = 30_000;
const IMAGE_CONCURRENCY = 6;

let processing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function getStore() {
  return useLocalStore.getState();
}

function pendingItems(): FiaAttachmentQueueItem[] {
  return getStore().fiaAttachmentQueue.filter(
    (i) =>
      i.status === 'pending' ||
      i.status === 'failed' ||
      i.status === 'downloading'
  );
}

export function enqueue(pericopeId: string, projectId: string) {
  getStore().enqueueFiaAttachment({ pericopeId, projectId });
  void processQueue();
}

export function initializeFiaQueue() {
  const store = getStore();
  const stuck = store.fiaAttachmentQueue.filter(
    (i) => i.status === 'downloading'
  );
  for (const item of stuck) {
    store.updateFiaAttachment(item.pericopeId, { status: 'pending' });
  }
  if (pendingItems().length > 0) {
    console.log(
      `[FiaAttachmentQueue] Resuming ${pendingItems().length} items on init`
    );
    void processQueue();
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    let items = pendingItems();
    while (items.length > 0) {
      const item = items[0]!;
      await processItem(item);
      items = pendingItems();
    }
  } finally {
    processing = false;
  }
}

async function processItem(item: FiaAttachmentQueueItem) {
  const { pericopeId, projectId } = item;
  const store = getStore();

  if (isFiaPericopeCached(pericopeId)) {
    store.updateFiaAttachment(pericopeId, {
      status: 'completed',
      completedAt: Date.now()
    });
    return;
  }

  store.updateFiaAttachment(pericopeId, { status: 'downloading' });
  console.log(`[FiaAttachmentQueue] Processing ${pericopeId}...`);

  try {
    const data = await fetchPericopeSteps(projectId, pericopeId);
    if (!data) throw new Error('Empty response from edge function');

    const imageUrls = extractImageUrls(data);
    console.log(
      `[FiaAttachmentQueue] Downloading ${imageUrls.length} images for ${pericopeId}...`
    );
    await downloadImages(imageUrls);

    writeFile(pericopeDataPath(pericopeId), JSON.stringify(data));

    getStore().updateFiaAttachment(pericopeId, {
      status: 'completed',
      completedAt: Date.now()
    });

    console.log(
      `[FiaAttachmentQueue] ✓ ${pericopeId} (${imageUrls.length} images)`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[FiaAttachmentQueue] ✗ ${pericopeId}: ${msg}`);
    getStore().updateFiaAttachment(pericopeId, {
      status: 'failed',
      error: msg
    });
    scheduleRetry();
  }
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

async function fetchPericopeSteps(
  projectId: string,
  pericopeId: string
): Promise<FiaPericopeStepsResponse> {
  console.log(
    `[FiaAttachmentQueue] Looking up languoid for project ${projectId}...`
  );
  const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
  if (!sourceLanguoidId)
    throw new Error('Could not find source languoid for project');

  console.log(
    `[FiaAttachmentQueue] Looking up FIA code for languoid ${sourceLanguoidId}...`
  );
  const fiaCode = await lookupFiaLanguageCode(sourceLanguoidId);
  if (!fiaCode)
    throw new Error(`No FIA language code for languoid ${sourceLanguoidId}`);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl)
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not configured');

  const {
    data: { session }
  } = await system.supabaseConnector.client.auth.getSession();
  const token =
    session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!token) throw new Error('No auth token or anon key available');

  const url = `${supabaseUrl}/functions/v1/fia-pericope-steps`;
  console.log(
    `[FiaAttachmentQueue] Fetching edge function: ${url} (fiaCode=${fiaCode}, pericopeId=${pericopeId})`
  );

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ pericopeId, fiaLanguageCode: fiaCode })
    },
    FETCH_TIMEOUT_MS
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FIA steps request failed (${res.status}): ${body}`);
  }

  console.log(`[FiaAttachmentQueue] Edge function responded OK for ${pericopeId}`);
  return res.json();
}

async function downloadImages(urls: string[]) {
  ensureDir(`${getDocumentDirectory()}/${IMAGES_DIR}`);
  const queue = [...urls];
  const active: Promise<void>[] = [];

  const next = async () => {
    while (queue.length > 0) {
      const url = queue.shift()!;
      const dest = imageCachePath(url);
      if (fileExists(dest)) continue;
      try {
        await downloadFile(url, dest);
      } catch (e) {
        console.warn(`[FiaAttachmentQueue] Image download failed: ${url}`, e);
      }
    }
  };

  for (let i = 0; i < Math.min(IMAGE_CONCURRENCY, urls.length); i++) {
    active.push(next());
  }
  await Promise.allSettled(active);
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void processQueue();
  }, RETRY_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Hook for components to observe a single pericope's status
// ---------------------------------------------------------------------------

export function useFiaAttachmentStatus(pericopeId: string | undefined) {
  const status = useLocalStore(
    useShallow((state) => {
      if (!pericopeId) return undefined;
      const item = state.fiaAttachmentQueue.find(
        (i) => i.pericopeId === pericopeId
      );
      if (!item) return undefined;
      return {
        status: item.status,
        completedAt: item.completedAt,
        error: item.error
      };
    })
  );
  return status;
}

export function useFiaAttachmentQueueSummary() {
  return useLocalStore(
    useShallow((state) => {
      const q = state.fiaAttachmentQueue;
      const downloading = q.filter(
        (i) => i.status === 'downloading'
      ).length;
      const pending = q.filter((i) => i.status === 'pending').length;
      const failed = q.filter((i) => i.status === 'failed').length;
      const completed = q.filter((i) => i.status === 'completed').length;
      const lastError = q.find((i) => i.status === 'failed')?.error;
      return {
        total: q.length,
        downloading,
        pending,
        failed,
        completed,
        lastError,
        hasActivity: downloading > 0 || pending > 0
      };
    })
  );
}
