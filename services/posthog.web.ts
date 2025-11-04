import { useLocalStore } from '@/store/localStore';
import posthog from 'posthog-js';

function isDevEnvironment() {
  // __DEV__ may or may not exist on web
  const isDevFlag = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  return isDevFlag;
}

function isDisabled(): boolean {
  return (
    isDevEnvironment() ||
    !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
    !process.env.EXPO_PUBLIC_POSTHOG_KEY
  );
}

function createPostHogInstance(optIn = false) {
  try {
    posthog.init(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
      api_host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/relay-Mx9k`,
      opt_out_capturing_by_default: isDisabled()
    });

    if (optIn) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  } catch (error) {
    console.warn('Failed to initialize PostHog (web):', error);
  }

  return posthog;
}

// Initialize immediately with conservative defaults; we'll wire consent via store below
createPostHogInstance(false);

function changeAnalyticsState(newState: boolean) {
  if (isDisabled()) return;
  if (newState) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export const initializePostHogWithStore = () => {
  const { dateTermsAccepted, analyticsOptOut } = useLocalStore.getState();

  try {
    const shouldOptIn = !analyticsOptOut && !!dateTermsAccepted;

    void changeAnalyticsState(shouldOptIn);

    let previousOptOut = analyticsOptOut;
    let previousTermsDate = dateTermsAccepted;

    const unsubscribe = useLocalStore.subscribe((state) => {
      const { analyticsOptOut: newOptOut, dateTermsAccepted: newTermsDate } =
        state;

      if (newOptOut !== previousOptOut || newTermsDate !== previousTermsDate) {
        previousOptOut = newOptOut;
        previousTermsDate = newTermsDate;

        const newShouldOptIn = !newOptOut && !!newTermsDate;
        void changeAnalyticsState(newShouldOptIn);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.warn('Failed to initialize PostHog with store (web):', error);
  }
};

export { posthog };
export default posthog;
