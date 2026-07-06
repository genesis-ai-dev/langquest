import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';

export function hasCompletedAnalyticsConsent(
  analyticsConsentAt: Date | null | undefined
): boolean {
  return analyticsConsentAt != null;
}

export function profileNeedsAnalyticsConsent(
  analyticsOptIn: boolean | null | undefined
): boolean {
  return analyticsOptIn === null || analyticsOptIn === undefined;
}

export function shouldShowAnalyticsConsentGate(params: {
  postHogAvailable: boolean;
  analyticsConsentAt: Date | null;
  profileAnalyticsOptIn: boolean | null | undefined;
  isAuthenticated: boolean;
  profileLoaded: boolean;
}): boolean {
  if (
    !params.postHogAvailable ||
    !params.isAuthenticated ||
    !params.profileLoaded
  ) {
    return false;
  }

  if (!profileNeedsAnalyticsConsent(params.profileAnalyticsOptIn)) {
    return false;
  }

  if (hasCompletedAnalyticsConsent(params.analyticsConsentAt)) {
    return false;
  }

  return true;
}

export function resetLocalAnalyticsConsentOnSignOut() {
  useLocalStore.setState({
    analyticsConsentAt: null,
    analyticsOptOut: true
  });
}

export async function syncAnalyticsPreferenceToProfile(optIn: boolean) {
  try {
    const {
      data: { session }
    } = await system.supabaseConnector.client.auth.getSession();

    if (!session) {
      return;
    }

    const consentAt = new Date().toISOString();

    const { error } = await system.supabaseConnector.client
      .from('profile')
      .update({
        analytics_opt_in: optIn,
        analytics_consent_at: consentAt
      })
      .eq('id', session.user.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Failed to sync analytics preference to profile:', error);
  }
}

export type ProfileAnalyticsPreference = {
  analytics_opt_in?: boolean | null;
  analytics_consent_at?: string | null;
};

export function applyAnalyticsPreferenceFromProfile(
  profile: ProfileAnalyticsPreference
) {
  const {
    analytics_opt_in: analyticsOptIn,
    analytics_consent_at: analyticsConsentAt
  } = profile;

  if (profileNeedsAnalyticsConsent(analyticsOptIn)) {
    return;
  }

  if (analyticsOptIn === true) {
    useLocalStore.getState().setAnalyticsOptOut(false);
  } else if (analyticsOptIn === false) {
    useLocalStore.getState().setAnalyticsOptOut(true);
  }

  const { analyticsConsentAt: localConsentAt } = useLocalStore.getState();
  if (!localConsentAt) {
    useLocalStore.setState({
      analyticsConsentAt: analyticsConsentAt
        ? new Date(analyticsConsentAt)
        : new Date()
    });
  }
}
