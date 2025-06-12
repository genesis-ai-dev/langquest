import { useLocalStore } from '@/store/localStore';
import PostHog from 'posthog-react-native';

const createPostHogInstance = () => {
  // Get fresh state without hooks
  const { dateTermsAccepted, analyticsOptOut } = useLocalStore.getState();
  const defaultOptIn = !analyticsOptOut && !!dateTermsAccepted;

  return new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
    host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllImages: false,
      maskAllTextInputs: false
    },
    enablePersistSessionIdAcrossRestart: true,
    defaultOptIn,
    disabled:
      process.env.EXPO_PUBLIC_APP_VARIANT === 'development' ||
      __DEV__ ||
      !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
      !process.env.EXPO_PUBLIC_POSTHOG_KEY
  });
};

// Initialize PostHog instance
export let posthog = createPostHogInstance();

// Subscribe to store changes and recreate PostHog when analytics settings change
let previousAnalyticsOptOut: boolean | undefined;
let previousDateTermsAccepted: Date | null | undefined;

useLocalStore.subscribe((state) => {
  const { analyticsOptOut, dateTermsAccepted } = state;

  // Check if analytics-related settings have changed
  if (
    analyticsOptOut !== previousAnalyticsOptOut ||
    dateTermsAccepted !== previousDateTermsAccepted
  ) {
    // Update previous values
    previousAnalyticsOptOut = analyticsOptOut;
    previousDateTermsAccepted = dateTermsAccepted;

    // Recreate PostHog instance with new settings
    posthog = createPostHogInstance();
  }
});

// Initialize previous values
const initialState = useLocalStore.getState();
previousAnalyticsOptOut = initialState.analyticsOptOut;
previousDateTermsAccepted = initialState.dateTermsAccepted;

export default posthog;
