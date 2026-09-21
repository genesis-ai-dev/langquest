/// <reference types="jest" />

import { Platform } from 'react-native';

import {
  STORE_UPDATE_DISMISSAL_MS,
  getLatestStoreVersion,
  getStoreUrl,
  shouldShowStoreUpdateBanner,
  type SystemInfoRow
} from '../storeUpdateAvailability';

const info: SystemInfoRow = {
  ios_latest_version: '2.3.0',
  android_latest_version: '2.4.0',
  ios_store_url: 'https://apps.apple.com/app/ios',
  android_store_url: 'https://play.google.com/store/apps/details?id=android',
  banner_enabled: true
};

describe('getLatestStoreVersion / getStoreUrl', () => {
  const originalOS = Platform.OS;

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('returns the iOS fields on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(getLatestStoreVersion(info)).toBe('2.3.0');
    expect(getStoreUrl(info)).toBe(info.ios_store_url);
  });

  it('returns the Android fields on Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(getLatestStoreVersion(info)).toBe('2.4.0');
    expect(getStoreUrl(info)).toBe(info.android_store_url);
  });

  it('returns null on other platforms', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    expect(getLatestStoreVersion(info)).toBeNull();
    expect(getStoreUrl(info)).toBeNull();
  });
});

describe('shouldShowStoreUpdateBanner', () => {
  const visible = {
    bannerEnabled: true,
    isUpdateAvailable: true,
    latestVersion: '2.3.0',
    dismissedTimestamp: null,
    dismissedVersion: null
  };

  it('hides when the banner is disabled', () => {
    expect(
      shouldShowStoreUpdateBanner({ ...visible, bannerEnabled: false })
    ).toBe(false);
  });

  it('hides when the installed version is not older', () => {
    expect(
      shouldShowStoreUpdateBanner({ ...visible, isUpdateAvailable: false })
    ).toBe(false);
  });

  it('hides when there is no latest store version', () => {
    expect(
      shouldShowStoreUpdateBanner({ ...visible, latestVersion: null })
    ).toBe(false);
  });

  it('shows when a newer store version is available and nothing was dismissed', () => {
    expect(shouldShowStoreUpdateBanner(visible)).toBe(true);
  });

  it('hides for 24 hours after dismissing the same version', () => {
    const now = 1_000_000;
    expect(
      shouldShowStoreUpdateBanner({
        ...visible,
        dismissedTimestamp: now - STORE_UPDATE_DISMISSAL_MS + 1,
        dismissedVersion: '2.3.0',
        now
      })
    ).toBe(false);
  });

  it('shows again after the dismissal window for the same version', () => {
    const now = 1_000_000;
    expect(
      shouldShowStoreUpdateBanner({
        ...visible,
        dismissedTimestamp: now - STORE_UPDATE_DISMISSAL_MS,
        dismissedVersion: '2.3.0',
        now
      })
    ).toBe(true);
  });

  it('shows again when a newer store version lands after dismissal', () => {
    expect(
      shouldShowStoreUpdateBanner({
        ...visible,
        latestVersion: '2.4.0',
        dismissedTimestamp: Date.now(),
        dismissedVersion: '2.3.0'
      })
    ).toBe(true);
  });
});
