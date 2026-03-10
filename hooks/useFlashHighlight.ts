import { useSyncExternalStore } from 'react';

let flashingIds = new Set<string>();
let listeners: Array<() => void> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

/**
 * Trigger a 5-second flash highlight on the given asset IDs.
 * Cards using `useIsFlashing` will pick this up automatically.
 */
export function triggerFlash(ids: string[]) {
  if (timer) clearTimeout(timer);
  flashingIds = new Set(ids);
  notifyListeners();
  timer = setTimeout(() => {
    flashingIds = new Set();
    notifyListeners();
  }, 5500);
}

/**
 * Subscribe a card to the flash state for a specific asset ID.
 * Returns true while the asset should display a fading highlight.
 */
export function useIsFlashing(assetId: string): boolean {
  return useSyncExternalStore(subscribe, () => flashingIds.has(assetId));
}
