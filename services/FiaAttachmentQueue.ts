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
const IMAGE_CONCURRENCY = 6;

let processing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function getStore() {
  return useLocalStore.getState();
}

function pendingItems(): FiaAttachmentQueueItem[] {
  return getStore().fiaAttachmentQueue.filter(
    (i) => i.status === 'pending' || i.status === 'failed'
  );
}

export function enqueue(pericopeId: string, projectId: string) {
  getStore().enqueueFiaAttachment({ pericopeId, projectId });
  void processQueue();
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

  try {
    const data = await fetchPericopeSteps(projectId, pericopeId);
    if (!data) throw new Error('Empty response from edge function');

    // Download images concurrently (bounded)
    const imageUrls = extractImageUrls(data);
    await downloadImages(imageUrls);

    // Persist pericope JSON
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

async function fetchPericopeSteps(
  projectId: string,
  pericopeId: string
): Promise<FiaPericopeStepsResponse> {
  const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
  if (!sourceLanguoidId)
    throw new Error('Could not find source languoid for project');

  const fiaCode = await lookupFiaLanguageCode(sourceLanguoidId);
  if (!fiaCode)
    throw new Error(`No FIA language code for languoid ${sourceLanguoidId}`);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const {
    data: { session }
  } = await system.supabaseConnector.client.auth.getSession();
  const token =
    session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/fia-pericope-steps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ pericopeId, fiaLanguageCode: fiaCode })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FIA steps request failed (${res.status}): ${body}`);
  }

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

/**
 * Resume processing after app restart / store rehydration.
 * Called once by the store's onRehydrateStorage callback so that items
 * reset from 'downloading' → 'pending' actually get picked up.
 */
export function resumeQueue() {
  void processQueue();
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
      const pending = q.filter(
        (i) => i.status === 'pending' || i.status === 'downloading'
      ).length;
      const failed = q.filter((i) => i.status === 'failed').length;
      const completed = q.filter((i) => i.status === 'completed').length;
      return {
        total: q.length,
        pending,
        failed,
        completed,
        hasActivity: pending > 0
      };
    })
  );
}
