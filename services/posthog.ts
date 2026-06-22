import { canCaptureAccountLinkedAnalytics } from '@/constants/legalVersions';
import {
  isPostHogAvailable,
  isPostHogEnvConfigured,
  isPostHogRegionBlocked,
  initPostHogRegionOnNetworkReconnect,
  setPostHogRelayIngestRegionBlocked
} from '@/services/postHogAvailability';
import { subscribeIpRegion } from '@/services/ipRegion';
import { useLocalStore } from '@/store/localStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PostHogFetchOptions, PostHogFetchResponse } from '@posthog/core';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import PostHog, { PostHogOptions } from 'posthog-react-native';

function isPostHogStaticallyDisabled() {
  // Region gating is handled by isPostHogAvailable(); do not bake it into disabled
  // because edge geolocation resolves asynchronously after module import.
  return !isPostHogEnvConfigured();
}

function isPostHogDisabled() {
  return !isPostHogAvailable();
}

const posthogErrorTracking = {
  autocapture: {
    uncaughtExceptions: true,
    unhandledRejections: true,
    console: ['error', 'warn']
  }
} satisfies PostHogOptions['errorTracking'];

function createDiscardedPostHogFetchResponse(): PostHogFetchResponse {
  return {
    status: 200,
    text: async () => '',
    json: async () => ({ status: 'ok' })
  };
}

function isPostHogRelayIngestRequest(url: string): boolean {
  const relayHost = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();
  if (!relayHost) {
    return false;
  }

  return url.startsWith(relayHost) && url.includes('/ingest');
}

class LangQuestPostHog extends PostHog {
  async fetch(
    url: string,
    options: PostHogFetchOptions
  ): Promise<PostHogFetchResponse> {
    if (isPostHogRegionBlocked()) {
      return createDiscardedPostHogFetchResponse();
    }

    const response = await super.fetch(url, options);

    if (isPostHogRelayIngestRequest(url) && response.status === 403) {
      setPostHogRelayIngestRegionBlocked(true);
      void applyPostHogCaptureState();
      return createDiscardedPostHogFetchResponse();
    }

    return response;
  }
}

// Simple initialization without circular dependency
const createPostHogInstance = (optIn = false) => {
  return new LangQuestPostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
    host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllImages: false,
      maskAllTextInputs: false,
      maskAllSandboxedViews: true
    },
    errorTracking: posthogErrorTracking,
    enablePersistSessionIdAcrossRestart: true,
    defaultOptIn: optIn,
    disabled: isPostHogStaticallyDisabled(),
    customStorage: AsyncStorage
  });
};

// Initialize PostHog with basic settings immediately (no circular dependency)
let posthog = createPostHogInstance();

let pendingPostHogUserId: string | null = null;
let lastIdentifiedPostHogUserId: string | null = null;

function getAnalyticsOptIn() {
  const {
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  } = useLocalStore.getState();

  return canCaptureAccountLinkedAnalytics({
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  });
}

/** Keeps the SDK opt-in state aligned with region gating and local consent. */
export async function applyPostHogCaptureState() {
  if (isPostHogDisabled()) {
    await posthog.optOut();
    return;
  }

  const shouldOptIn = getAnalyticsOptIn();
  await changeAnalyticsState(shouldOptIn);
}

/**
 * Links PostHog persons to Supabase auth user ids for field troubleshooting.
 * Call from AuthContext when session changes; identity is applied only when analytics is opted in.
 */
export const syncPostHogIdentity = async () => {
  if (isPostHogDisabled()) {
    return;
  }

  const shouldOptIn = getAnalyticsOptIn();

  try {
    if (shouldOptIn && pendingPostHogUserId) {
      await posthog.identify(pendingPostHogUserId);
      lastIdentifiedPostHogUserId = pendingPostHogUserId;
    } else if (lastIdentifiedPostHogUserId !== null) {
      posthog.reset();
      lastIdentifiedPostHogUserId = null;
    }
  } catch (error) {
    console.warn('Failed to sync PostHog identity:', error);
  }
};

/** Set the authenticated user id (or null). Re-syncs identity when consent allows. */
export const setPostHogUserId = (userId: string | null) => {
  pendingPostHogUserId = userId;
  void syncPostHogIdentity();
};

const changeAnalyticsState = async (newState: boolean) => {
  if (newState) {
    await posthog.optIn();
    // Set device info after opt-in
    void setDeviceInfo();
  } else {
    await posthog.optOut();
  }

  await syncPostHogIdentity();
};

/**
 * Collects additional device information not automatically captured by PostHog React Native SDK.
 * PostHog already captures: OS name, OS version, app build, app name, app namespace, app version, device type.
 * This function adds: device manufacturer, model, and OTA update ID.
 * These properties will be included with all events automatically.
 * Only runs if user has opted in to analytics.
 */
const setDeviceInfo = async () => {
  try {
    const deviceProperties: Record<string, string | null> = {};

    // Additional device properties not auto-captured by PostHog SDK
    if (Device.brand) {
      deviceProperties.$device_manufacturer = Device.brand;
    }
    if (Device.modelName) {
      deviceProperties.$device_model = Device.modelName;
    }

    // OTA update ID from expo-updates (not automatically captured)
    if (Updates.updateId) {
      deviceProperties.$update_id = Updates.updateId;
    }

    // Filter out null values and register as super properties
    const validProperties = Object.fromEntries(
      Object.entries(deviceProperties).filter(([_, value]) => value !== null)
    );

    if (Object.keys(validProperties).length > 0) {
      await posthog.register(validProperties);
    }
  } catch (error) {
    // Silently handle errors - device info is optional and shouldn't break analytics
    console.warn('Failed to set device info for PostHog:', error);
  }
};

// Function to update PostHog settings once store is available
// This will be called from the app initialization, not during module import
export const initializePostHogWithStore = () => {
  const {
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  } = useLocalStore.getState();
  try {
    void applyPostHogCaptureState();

    const unsubscribeIpRegion = subscribeIpRegion(() => {
      void applyPostHogCaptureState();
    });

    const unsubscribeNetwork = initPostHogRegionOnNetworkReconnect(() =>
      applyPostHogCaptureState()
    );

    // Subscribe to future changes
    let previousOptOut = analyticsOptOut;
    let previousTermsDate = dateTermsAccepted;
    let previousPrivacyPolicyVersion = acceptedPrivacyPolicyVersion;
    let previousSubjectToLegalEffectiveDateWait =
      subjectToLegalEffectiveDateWait;

    const unsubscribe = useLocalStore.subscribe((state) => {
      const {
        analyticsOptOut: newOptOut,
        dateTermsAccepted: newTermsDate,
        acceptedPrivacyPolicyVersion: newPrivacyPolicyVersion,
        subjectToLegalEffectiveDateWait: newSubjectToLegalEffectiveDateWait
      } = state;

      // Only update if the relevant values actually changed
      if (
        newOptOut !== previousOptOut ||
        newTermsDate !== previousTermsDate ||
        newPrivacyPolicyVersion !== previousPrivacyPolicyVersion ||
        newSubjectToLegalEffectiveDateWait !==
          previousSubjectToLegalEffectiveDateWait
      ) {
        previousOptOut = newOptOut;
        previousTermsDate = newTermsDate;
        previousPrivacyPolicyVersion = newPrivacyPolicyVersion;
        previousSubjectToLegalEffectiveDateWait =
          newSubjectToLegalEffectiveDateWait;

        void applyPostHogCaptureState();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeIpRegion();
      unsubscribeNetwork();
    };
  } catch (error) {
    console.warn('Failed to initialize PostHog with store:', error);
  }
};

export { posthog };
export default posthog;
