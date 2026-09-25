import { Platform } from 'react-native';

export const STORE_UPDATE_DISMISSAL_MS = 24 * 60 * 60 * 1000;

export interface SystemInfoRow {
  ios_latest_version: string;
  android_latest_version: string;
  ios_store_url: string | null;
  android_store_url: string | null;
  banner_enabled: boolean;
}

export interface StoreUpdateBannerInput {
  bannerEnabled: boolean;
  isUpdateAvailable: boolean;
  latestVersion: string | null;
  dismissedTimestamp: number | null;
  dismissedVersion: string | null;
  now?: number;
}

export function getLatestStoreVersion(info: SystemInfoRow): string | null {
  if (Platform.OS === 'ios') {
    return info.ios_latest_version;
  }

  if (Platform.OS === 'android') {
    return info.android_latest_version;
  }

  return null;
}

export function getStoreUrl(info: SystemInfoRow): string | null {
  if (Platform.OS === 'ios') {
    return info.ios_store_url;
  }

  if (Platform.OS === 'android') {
    return info.android_store_url;
  }

  return null;
}

export function shouldShowStoreUpdateBanner({
  bannerEnabled,
  isUpdateAvailable,
  latestVersion,
  dismissedTimestamp,
  dismissedVersion,
  now = Date.now()
}: StoreUpdateBannerInput): boolean {
  if (!bannerEnabled) {
    return false;
  }

  if (!isUpdateAvailable || !latestVersion) {
    return false;
  }

  if (!dismissedTimestamp || !dismissedVersion) {
    return true;
  }

  if (latestVersion !== dismissedVersion) {
    return true;
  }

  return now - dismissedTimestamp >= STORE_UPDATE_DISMISSAL_MS;
}
