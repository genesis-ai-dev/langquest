import {
  CURRENT_LEGAL_VERSION,
  inferSubjectToLegalEffectiveDateWait,
  resolveAcceptedPrivacyPolicyVersion
} from '@/constants/legalVersions';
import { getProfileByUserId } from '@/hooks/db/useProfiles';
import {
  applyAnalyticsPreferenceFromProfile,
  syncAnalyticsPreferenceToProfile
} from '@/services/analyticsConsent';
import { applyPostHogCaptureState } from '@/services/posthog';
import { useLocalStore } from '@/store/localStore';

export async function syncAccountPreferencesFromProfile(userId: string) {
  try {
    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return;
    }

    const profilePrivacyPolicyVersion = resolveAcceptedPrivacyPolicyVersion(
      profile.privacy_policy_version
    );

    const subjectToLegalEffectiveDateWait =
      inferSubjectToLegalEffectiveDateWait(profile);

    if (
      profile.terms_accepted &&
      profilePrivacyPolicyVersion === CURRENT_LEGAL_VERSION
    ) {
      const {
        dateTermsAccepted,
        acceptedPrivacyPolicyVersion,
        subjectToLegalEffectiveDateWait: localSubjectToLegalEffectiveDateWait
      } = useLocalStore.getState();
      if (
        !dateTermsAccepted ||
        acceptedPrivacyPolicyVersion !== CURRENT_LEGAL_VERSION
      ) {
        useLocalStore
          .getState()
          .acceptTerms(
            subjectToLegalEffectiveDateWait
              ? { subjectToLegalEffectiveDateWait: true }
              : undefined
          );
      } else if (
        subjectToLegalEffectiveDateWait &&
        !localSubjectToLegalEffectiveDateWait
      ) {
        useLocalStore.setState({ subjectToLegalEffectiveDateWait: true });
      }
    } else if (subjectToLegalEffectiveDateWait) {
      useLocalStore.setState({ subjectToLegalEffectiveDateWait: true });
    }

    applyAnalyticsPreferenceFromProfile(profile);
  } catch (error) {
    console.warn('Failed to sync account preferences from profile:', error);
  }
}

export function saveAnalyticsPreference(optIn: boolean) {
  useLocalStore.getState().setAnalyticsConsent(optIn);
  void applyPostHogCaptureState();
  void syncAnalyticsPreferenceToProfile(optIn);
}
