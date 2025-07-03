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
      process.env.EXPO_PUBLIC_APP_VARIANT === 'development' ||
      __DEV__ ||
      !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
      !process.env.EXPO_PUBLIC_POSTHOG_KEY
  });
};

// Initialize PostHog with basic settings immediately (no circular dependency)
const posthog = createPostHogInstance(false);

// Function to update PostHog settings once store is available
// This will be called from the app initialization, not during module import
export const initializePostHogWithStore = (
  getStoreState: () => { dateTermsAccepted: Date | null; analyticsOptOut: boolean },
  subscribeToStore: (callback: (state: { dateTermsAccepted: Date | null; analyticsOptOut: boolean }) => void) => void
) => {
  try {
    const { dateTermsAccepted, analyticsOptOut } = getStoreState();

    // Update PostHog opt-in status based on store
    const shouldOptIn = !analyticsOptOut && !!dateTermsAccepted;

    if (shouldOptIn) {
      void posthog.optIn();
    } else {
      void posthog.optOut();
    }

    // Subscribe to future changes
    let previousAnalyticsOptOut = analyticsOptOut;
    let previousDateTermsAccepted = dateTermsAccepted;

    subscribeToStore((state) => {
      const { analyticsOptOut: newOptOut, dateTermsAccepted: newTermsDate } = state;

      // Check if analytics-related settings have changed
      if (
        newOptOut !== previousAnalyticsOptOut ||
        newTermsDate !== previousDateTermsAccepted
      ) {
        // Update previous values
        previousAnalyticsOptOut = newOptOut;
        previousDateTermsAccepted = newTermsDate;

        // Update PostHog opt-in status
        const newShouldOptIn = !newOptOut && !!newTermsDate;

        if (newShouldOptIn) {
          void posthog.optIn();
        } else {
          void posthog.optOut();
        }
      }
    });
  } catch (error) {
    console.warn('Failed to initialize PostHog with store:', error);
  }
};

export { posthog };
export default posthog;
