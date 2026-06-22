import { isEuEeaGbCountryCode } from '@/utils/euRegion';

const GEO_REGION_API_KEY_HEADER = 'X-LangQuest-Geo-Key';
const GEO_REGION_FETCH_TIMEOUT_MS = 5_000;

function getGeoRegionUrl(): string {
  return process.env.EXPO_PUBLIC_GEO_REGION_URL?.trim() ?? '';
}

function getGeoRegionApiKey(): string | null {
  const apiKey = process.env.EXPO_PUBLIC_GEO_REGION_API_KEY?.trim() ?? '';
  return apiKey.length > 0 ? apiKey : null;
}

let ipCountryCode: string | null | undefined;
let ipRegionResolved = false;
let ipRegionVersion = 0;

const ipRegionListeners = new Set<() => void>();

function notifyIpRegionListeners(): void {
  ipRegionVersion += 1;
  for (const listener of ipRegionListeners) {
    listener();
  }
}

export function subscribeIpRegion(listener: () => void): () => void {
  ipRegionListeners.add(listener);
  return () => {
    ipRegionListeners.delete(listener);
  };
}

export function getIpRegionSnapshot(): number {
  return ipRegionVersion;
}

/** Notifies region-gate subscribers (IP lookup, relay block, etc.). */
export function bumpRegionGate(): void {
  notifyIpRegionListeners();
}

let ipRegionWarmStarted = false;

/** Non-blocking background lookup. Safe to call multiple times. */
export function warmIpRegionInBackground(): void {
  if (ipRegionWarmStarted) {
    return;
  }

  ipRegionWarmStarted = true;
  void resolveIpCountryCode();
}

export function isGeoRegionCheckConfigured(): boolean {
  return getGeoRegionUrl().length > 0 && getGeoRegionApiKey() !== null;
}

export function isIpRegionResolved(): boolean {
  return ipRegionResolved || !isGeoRegionCheckConfigured();
}

export function getIpCountryCode(): string | null {
  return ipCountryCode ?? null;
}

export function isIpEuEeaGbRegion(): boolean {
  return isEuEeaGbCountryCode(getIpCountryCode());
}

/**
 * True while the geo Worker URL is configured but the lookup has not finished.
 */
export function isIpRegionCheckPending(): boolean {
  return isGeoRegionCheckConfigured() && !ipRegionResolved;
}

interface GeoRegionResponse {
  countryCode?: string | null;
  isEuEeaGb?: boolean;
}

/**
 * Resolves the caller country via the LangQuest geo Worker (Cloudflare edge).
 * IP is never returned or stored in the app — only the ISO country code is cached
 * in memory for the current session.
 */
/** Clears the in-memory IP cache so the next lookup runs again. */
export function invalidateIpRegionCache(): void {
  ipRegionResolved = false;
}

/** Re-runs the geo Worker lookup (e.g. after network reconnect). */
export async function refreshIpCountryCode(): Promise<string | null> {
  invalidateIpRegionCache();
  return resolveIpCountryCode();
}

export async function resolveIpCountryCode(): Promise<string | null> {
  if (ipRegionResolved) {
    return getIpCountryCode();
  }

  const geoRegionUrl = getGeoRegionUrl();
  const geoRegionApiKey = getGeoRegionApiKey();
  if (!geoRegionUrl || !geoRegionApiKey) {
    ipRegionResolved = true;
    ipCountryCode = null;
    notifyIpRegionListeners();
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GEO_REGION_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(geoRegionUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        [GEO_REGION_API_KEY_HEADER]: geoRegionApiKey
      }
    });

    if (!response.ok) {
      ipCountryCode = null;
      return null;
    }

    const payload = (await response.json()) as GeoRegionResponse;
    const rawCountryCode = payload.countryCode?.trim().toUpperCase() ?? null;
    ipCountryCode =
      rawCountryCode && rawCountryCode.length > 0 ? rawCountryCode : null;
    return getIpCountryCode();
  } catch {
    ipCountryCode = null;
    return null;
  } finally {
    clearTimeout(timeoutId);
    ipRegionResolved = true;
    notifyIpRegionListeners();
  }
}
