import { canCaptureAccountLinkedAnalytics } from '@/constants/legalVersions';
import {
  isPostHogAvailable,
  isPostHogEnvConfigured
} from '@/services/postHogAvailability';
import { useLocalStore } from '@/store/localStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import PostHog, { PostHogOptions } from 'posthog-react-native';

type CaptureMode = 'off' | 'full';

const DEVICE_SUPER_PROPERTIES = [
  '$device_manufacturer',
  '$device_model',
  '$update_id'
] as const;

function isPostHogStaticallyDisabled() {
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

let activeCaptureMode: CaptureMode = 'off';

const createPostHogInstance = () => {
  return new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_', {
    host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllImages: false,
      maskAllTextInputs: false,
      maskAllSandboxedViews: true
    },
    errorTracking: posthogErrorTracking,
    enablePersistSessionIdAcrossRestart: true,
    defaultOptIn: false,
    disabled: isPostHogStaticallyDisabled(),
    customStorage: AsyncStorage,
    personProfiles: 'identified_only',
    disableGeoip: true
  });
};

let posthog = createPostHogInstance();

let pendingPostHogUserId: string | null = null;
let lastIdentifiedPostHogUserId: string | null = null;
let sessionRecordingActive = false;

function isSignedIn() {
  return pendingPostHogUserId !== null;
}

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

function resolveCaptureMode(): CaptureMode {
  if (isPostHogDisabled() || !isSignedIn()) {
    return 'off';
  }

  return getAnalyticsOptIn() ? 'full' : 'off';
}

async function clearDeviceSuperProperties() {
  await Promise.all(
    DEVICE_SUPER_PROPERTIES.map((property) => posthog.unregister(property))
  );
}

async function startReplayIfNeeded() {
  if (sessionRecordingActive) {
    return;
  }

  try {
    await posthog.startSessionRecording();
    sessionRecordingActive = true;
  } catch (error) {
    console.warn('Failed to start PostHog session recording:', error);
  }
}

async function stopReplayIfNeeded() {
  if (!sessionRecordingActive) {
    return;
  }

  try {
    await posthog.stopSessionRecording();
    sessionRecordingActive = false;
  } catch (error) {
    console.warn('Failed to stop PostHog session recording:', error);
  }
}

async function applyCaptureMode(mode: CaptureMode) {
  const previousMode = activeCaptureMode;
  activeCaptureMode = mode;

  switch (mode) {
    case 'off':
      await stopReplayIfNeeded();
      await clearDeviceSuperProperties();
      await posthog.optOut();
      break;
    case 'full':
      await posthog.optIn();
      await startReplayIfNeeded();
      await setDeviceInfo();
      break;
  }

  if (mode !== 'full' && previousMode === 'full') {
    await clearDeviceSuperProperties();
  }

  await syncPostHogIdentity();
}

/** Keeps the SDK aligned with auth state and analytics consent. */
export async function applyPostHogCaptureState() {
  const mode = resolveCaptureMode();

  if (mode === activeCaptureMode) {
    await syncPostHogIdentity();
    return;
  }

  await applyCaptureMode(mode);
}

/**
 * Links PostHog persons to Supabase auth user ids for field troubleshooting.
 * Identity is applied only in full capture mode.
 */
export const syncPostHogIdentity = async () => {
  if (isPostHogDisabled() || activeCaptureMode !== 'full') {
    if (lastIdentifiedPostHogUserId !== null) {
      posthog.reset();
      lastIdentifiedPostHogUserId = null;
    }
    return;
  }

  if (!pendingPostHogUserId) {
    return;
  }

  try {
    await posthog.identify(pendingPostHogUserId);
    lastIdentifiedPostHogUserId = pendingPostHogUserId;
  } catch (error) {
    console.warn('Failed to sync PostHog identity:', error);
  }
};

/** Set the authenticated user id (or null). Re-syncs capture mode when auth changes. */
export const setPostHogUserId = (userId: string | null) => {
  pendingPostHogUserId = userId;
  void applyPostHogCaptureState();
};

const setDeviceInfo = async () => {
  try {
    const deviceProperties: Record<string, string | null> = {};

    if (Device.brand) {
      deviceProperties.$device_manufacturer = Device.brand;
    }
    if (Device.modelName) {
      deviceProperties.$device_model = Device.modelName;
    }
    if (Device.osVersion) {
      deviceProperties.$os_version = Device.osVersion;
    }
    if (Updates.updateId) {
      deviceProperties.$update_id = Updates.updateId;
    }

    const validProperties = Object.fromEntries(
      Object.entries(deviceProperties).filter(([_, value]) => value !== null)
    );

    if (Object.keys(validProperties).length > 0) {
      await posthog.register(validProperties);
    }
  } catch (error) {
    console.warn('Failed to set device info for PostHog:', error);
  }
};

export const initializePostHogWithStore = () => {
  try {
    void applyPostHogCaptureState();

    let previousOptOut = useLocalStore.getState().analyticsOptOut;
    let previousTermsDate = useLocalStore.getState().dateTermsAccepted;
    let previousPrivacyPolicyVersion =
      useLocalStore.getState().acceptedPrivacyPolicyVersion;
    let previousSubjectToLegalEffectiveDateWait =
      useLocalStore.getState().subjectToLegalEffectiveDateWait;

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

        void applyPostHogCaptureState();
      }
    });

    return () => {
      unsubscribe();
    };
  } catch (error) {
    console.warn('Failed to initialize PostHog with store:', error);
  }
};

export { posthog };
export default posthog;
