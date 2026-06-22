import {
  bumpRegionGate,
  getIpRegionSnapshot,
  invalidateIpRegionCache,
  isIpEuEeaGbRegion,
  refreshIpCountryCode,
  subscribeIpRegion,
  warmIpRegionInBackground
} from '@/services/ipRegion';
import { useNetworkStore } from '@/store/networkStore';
import { isEuDeviceRegion } from '@/utils/euRegion';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

export function isPostHogEnvConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_POSTHOG_HOST && process.env.EXPO_PUBLIC_POSTHOG_KEY
  );
}

let relayIngestRegionBlocked = false;

/**
 * Set when the PostHog relay returns 403 for ingest (edge EU/EEA/GB block).
 * Cleared on network reconnect so location can be re-evaluated.
 */
export function isPostHogRelayIngestRegionBlocked(): boolean {
  return relayIngestRegionBlocked;
}

export function setPostHogRelayIngestRegionBlocked(blocked: boolean): void {
  if (relayIngestRegionBlocked === blocked) {
    return;
  }

  relayIngestRegionBlocked = blocked;
  bumpRegionGate();
}

export function clearPostHogRelayRegionBlock(): void {
  setPostHogRelayIngestRegionBlocked(false);
}

/**
 * PostHog Cloud US is not used when device locale or edge geolocation positively
 * indicates EU, EEA, or UK. Unknown IP country does not block. The PostHog relay
 * Worker also geoblocks known EU/EEA/GB at the edge.
 */
export function isPostHogRegionBlocked(): boolean {
  if (
    isEuDeviceRegion() ||
    isIpEuEeaGbRegion() ||
    isPostHogRelayIngestRegionBlocked()
  ) {
    return true;
  }

  return false;
}

/**
 * On reconnect, re-fetch country via the geo Worker and refresh region gating.
 */
export function initPostHogRegionOnNetworkReconnect(
  onRegionChanged: () => void | Promise<void>
): () => void {
  let wasConnected = useNetworkStore.getState().isConnected;

  return useNetworkStore.subscribe((state) => {
    const isConnected = state.isConnected;

    if (!wasConnected && isConnected) {
      clearPostHogRelayRegionBlock();
      invalidateIpRegionCache();
      void refreshIpCountryCode().then(() => onRegionChanged());
    }

    wasConnected = isConnected;
  });
}

export function isPostHogDevEnvironment(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isPostHogAvailable(): boolean {
  return (
    Platform.OS !== 'web' &&
    // !isPostHogDevEnvironment() && // re-enable before release
    isPostHogEnvConfigured() &&
    !isPostHogRegionBlocked()
  );
}

/**
 * Reactive PostHog availability for UI gates. Warms IP region in the background
 * without blocking app startup.
 */
export function usePostHogAvailable(): boolean {
  useSyncExternalStore(subscribeIpRegion, getIpRegionSnapshot);

  warmIpRegionInBackground();

  return isPostHogAvailable();
}
