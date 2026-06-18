import { isEuDeviceRegion } from '@/utils/euRegion';

export function isPostHogEnvConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_POSTHOG_HOST && process.env.EXPO_PUBLIC_POSTHOG_KEY
  );
}

/** PostHog Cloud US is not used for EU/EEA/UK device regions (GDPR). */
export function isPostHogRegionBlocked(): boolean {
  return isEuDeviceRegion();
}

export function isPostHogDevEnvironment(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isPostHogAvailable(): boolean {
  return (
    !isPostHogDevEnvironment() &&
    isPostHogEnvConfigured() &&
    !isPostHogRegionBlocked()
  );
}
