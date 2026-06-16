import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';

export function hasCompletedAnalyticsConsent(
  analyticsConsentAt: Date | null | undefined
): boolean {
  return analyticsConsentAt != null;
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

export function applyAnalyticsPreferenceFromProfile(
  analyticsOptIn: boolean | null | undefined,
  analyticsConsentAt?: string | null
) {
  if (analyticsOptIn === true) {
    useLocalStore.getState().setAnalyticsOptOut(false);
  } else if (analyticsOptIn === false) {
    useLocalStore.getState().setAnalyticsOptOut(true);
  }

  // Hydrate local consent timestamp when the account already has a choice
  // (e.g. user accepted on another device).
  if (!profileNeedsAnalyticsConsent(analyticsOptIn)) {
    const { analyticsConsentAt: localConsentAt } = useLocalStore.getState();
    if (!localConsentAt) {
      useLocalStore.setState({
        analyticsConsentAt: analyticsConsentAt
          ? new Date(analyticsConsentAt)
          : new Date()
      });
    }
  }
}

export function profileNeedsAnalyticsConsent(
  analyticsOptIn: boolean | null | undefined
): boolean {
  return analyticsOptIn === null || analyticsOptIn === undefined;
}
