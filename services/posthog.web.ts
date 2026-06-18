import { canCaptureAccountLinkedAnalytics } from '@/constants/legalVersions';
import { isPostHogAvailable } from '@/services/postHogAvailability';
import { useLocalStore } from '@/store/localStore';
import posthog from 'posthog-js';

function isDisabled(): boolean {
  return !isPostHogAvailable();
}

function createPostHogInstance(optIn = false) {
  try {
    posthog.init(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
      api_host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/relay-Mx9k`,
      opt_out_capturing_by_default: isDisabled(),
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: true
      }
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

export const syncPostHogIdentity = () => {
  if (isDisabled()) {
    return;
  }

  const shouldOptIn = getAnalyticsOptIn();

  try {
    if (shouldOptIn && pendingPostHogUserId) {
      posthog.identify(pendingPostHogUserId);
      lastIdentifiedPostHogUserId = pendingPostHogUserId;
    } else if (lastIdentifiedPostHogUserId !== null) {
      posthog.reset();
      lastIdentifiedPostHogUserId = null;
    }
  } catch (error) {
    console.warn('Failed to sync PostHog identity (web):', error);
  }
};

export const setPostHogUserId = (userId: string | null) => {
  pendingPostHogUserId = userId;
  syncPostHogIdentity();
};

function changeAnalyticsState(newState: boolean) {
  if (isDisabled()) return;
  if (newState) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }

  syncPostHogIdentity();
}

export const initializePostHogWithStore = () => {
  const {
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  } = useLocalStore.getState();

  try {
    const shouldOptIn = canCaptureAccountLinkedAnalytics({
      dateTermsAccepted,
      acceptedPrivacyPolicyVersion,
      analyticsOptOut,
      subjectToLegalEffectiveDateWait
    });

    changeAnalyticsState(shouldOptIn);

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

        const newShouldOptIn = canCaptureAccountLinkedAnalytics({
          dateTermsAccepted: newTermsDate,
          acceptedPrivacyPolicyVersion: newPrivacyPolicyVersion,
          analyticsOptOut: newOptOut,
          subjectToLegalEffectiveDateWait: newSubjectToLegalEffectiveDateWait
        });
        changeAnalyticsState(newShouldOptIn);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.warn('Failed to initialize PostHog with store (web):', error);
  }
};

export { posthog };
export default posthog;
