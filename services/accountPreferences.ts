import {
  CURRENT_LEGAL_VERSION,
  resolveAcceptedPrivacyPolicyVersion
} from '@/constants/legalVersions';
import { getProfileByUserId } from '@/hooks/db/useProfiles';
import {
  applyAnalyticsPreferenceFromProfile,
  syncAnalyticsPreferenceToProfile
} from '@/services/analyticsConsent';
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

    if (
      profile.terms_accepted &&
      profilePrivacyPolicyVersion === CURRENT_LEGAL_VERSION
    ) {
      const { dateTermsAccepted, acceptedPrivacyPolicyVersion } =
        useLocalStore.getState();
      if (
        !dateTermsAccepted ||
        acceptedPrivacyPolicyVersion !== CURRENT_LEGAL_VERSION
      ) {
        useLocalStore.getState().acceptTerms();
      }
    }

    applyAnalyticsPreferenceFromProfile(
      profile.analytics_opt_in,
      profile.analytics_consent_at
    );
  } catch (error) {
    console.warn('Failed to sync account preferences from profile:', error);
  }
}

export function saveAnalyticsPreference(optIn: boolean) {
  useLocalStore.getState().setAnalyticsConsent(optIn);
  void syncAnalyticsPreferenceToProfile(optIn);
}
