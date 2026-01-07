import { useLocalStore } from '@/store/localStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import PostHog from 'posthog-react-native';

// Simple initialization without circular dependency
const createPostHogInstance = (optIn = false) => {
  return new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
    host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllImages: false,
      maskAllTextInputs: true
    },
    enablePersistSessionIdAcrossRestart: true,
    defaultOptIn: optIn,
    disabled:
      __DEV__ ||
      !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
      !process.env.EXPO_PUBLIC_POSTHOG_KEY,
    customStorage: AsyncStorage
  });
};

// Initialize PostHog with basic settings immediately (no circular dependency)
const posthog = createPostHogInstance();

const changeAnalyticsState = async (newState: boolean) => {
  if (newState) {
    await posthog.optIn();
    // Set device info after opt-in
    void setDeviceInfo();
  } else {
    await posthog.optOut();
  }
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
