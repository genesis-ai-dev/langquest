import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export function isPostHogEnvConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_POSTHOG_HOST && process.env.EXPO_PUBLIC_POSTHOG_KEY
  );
}

export function isPostHogDevEnvironment(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isPostHogAvailable(): boolean {
  return (
    Platform.OS !== 'web' &&
    !isPostHogDevEnvironment() &&
    isPostHogEnvConfigured()
  );
}

let postHogAvailabilityVersion = 0;
const postHogAvailabilityListeners = new Set<() => void>();

function notifyPostHogAvailabilityListeners(): void {
  postHogAvailabilityVersion += 1;
  for (const listener of postHogAvailabilityListeners) {
    listener();
  }
}

function subscribePostHogAvailability(listener: () => void): () => void {
  postHogAvailabilityListeners.add(listener);
  return () => {
    postHogAvailabilityListeners.delete(listener);
  };
}

function getPostHogAvailabilitySnapshot(): number {
  return postHogAvailabilityVersion;
}

/**
 * Reactive PostHog availability for UI gates (native production only).
 */
export function usePostHogAvailable(): boolean {
  useSyncExternalStore(
    subscribePostHogAvailability,
    getPostHogAvailabilitySnapshot
  );

  return isPostHogAvailable();
}

/** Reserved for future availability changes (e.g. remote kill switch). */
export function bumpPostHogAvailability(): void {
  notifyPostHogAvailabilityListeners();
}
