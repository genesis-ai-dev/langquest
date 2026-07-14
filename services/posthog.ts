import { useLocalStore } from '@/store/localStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import PostHog, { PostHogOptions } from 'posthog-react-native';

function isPostHogDisabled() {
  return (
    __DEV__ || // comment out when you want to test analytics locally (with preview environment eas env:pull <environment>)
    !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
    !process.env.EXPO_PUBLIC_POSTHOG_KEY
  );
}

const posthogErrorTracking = {
  autocapture: {
    uncaughtExceptions: true,
    unhandledRejections: true,
    console: ['error', 'warn']
  }
} satisfies PostHogOptions['errorTracking'];

// Simple initialization without circular dependency
const createPostHogInstance = (optIn = false) => {
  return new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
    host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllImages: false,
      maskAllTextInputs: true
    },
    errorTracking: posthogErrorTracking,
    enablePersistSessionIdAcrossRestart: true,
    defaultOptIn: optIn,
    disabled: isPostHogDisabled(),
    customStorage: AsyncStorage
  });
};

// Initialize PostHog with basic settings immediately (no circular dependency)
const posthog = createPostHogInstance();

let pendingPostHogUserId: string | null = null;
let lastIdentifiedPostHogUserId: string | null = null;

function getAnalyticsOptIn() {
  const { dateTermsAccepted, analyticsOptOut } = useLocalStore.getState();
  return !analyticsOptOut && !!dateTermsAccepted;
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

/**
 * Intentionally a no-op: identifying PostHog persons by auth user id is on
 * hold until GDPR requirements are sorted out. Restore the body below to
 * re-enable.
 */
export const setPostHogUserId = (_userId: string | null) => {
  // pendingPostHogUserId = _userId;
  // void syncPostHogIdentity();
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
  const { dateTermsAccepted, analyticsOptOut } = useLocalStore.getState();
  try {
    // Update PostHog opt-in status based on store
    const shouldOptIn = !analyticsOptOut && !!dateTermsAccepted;

    void changeAnalyticsState(shouldOptIn);

    // Subscribe to future changes
    let previousOptOut = analyticsOptOut;
    let previousTermsDate = dateTermsAccepted;

    const unsubscribe = useLocalStore.subscribe((state) => {
      const { analyticsOptOut: newOptOut, dateTermsAccepted: newTermsDate } =
        state;

      // Only update if the relevant values actually changed
      if (newOptOut !== previousOptOut || newTermsDate !== previousTermsDate) {
        previousOptOut = newOptOut;
        previousTermsDate = newTermsDate;

        const newShouldOptIn = !newOptOut && !!newTermsDate;
        void changeAnalyticsState(newShouldOptIn);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.warn('Failed to initialize PostHog with store:', error);
  }
};

export { posthog };
export default posthog;
