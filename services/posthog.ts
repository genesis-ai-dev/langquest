import { useLocalStore } from '@/store/localStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';

// Simple initialization without circular dependency
const createPostHogInstance = (optIn = false) => {
  return new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
    host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllImages: false,
      maskAllTextInputs: false
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
  } else {
    await posthog.optOut();
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
