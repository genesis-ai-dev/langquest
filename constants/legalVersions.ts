/** Matches langquest.org privacy policy version slugs (YYYY-MM-DD). */
export const LEGACY_LEGAL_VERSION = '2025-04-23';
export const CURRENT_LEGAL_VERSION = '2026-07-08';

/** Existing users may start account-linked analytics at this instant (UTC). */
export const CURRENT_LEGAL_EFFECTIVE_AT = new Date(Date.UTC(2026, 6, 8));

export function hasPassedLegalEffectiveDate(now = new Date()): boolean {
  return now.getTime() >= CURRENT_LEGAL_EFFECTIVE_AT.getTime();
}

export function inferSubjectToLegalEffectiveDateWait(profile: {
  privacy_policy_version?: string | null;
  terms_accepted_at?: string | null;
  created_at?: string | null;
}): boolean {
  if (!profile.terms_accepted_at) {
    return false;
  }

  const privacyVersion = resolveAcceptedPrivacyPolicyVersion(
    profile.privacy_policy_version ?? null
  );
  if (privacyVersion === LEGACY_LEGAL_VERSION) {
    return true;
  }

  if (
    profile.privacy_policy_version === CURRENT_LEGAL_VERSION &&
    profile.created_at
  ) {
    const createdAt = new Date(profile.created_at).getTime();
    const termsAt = new Date(profile.terms_accepted_at).getTime();
    return termsAt - createdAt > 60 * 60 * 1000;
  }

  return true;
}

export function canCaptureAccountLinkedAnalytics(params: {
  dateTermsAccepted: Date | null;
  acceptedPrivacyPolicyVersion: string | null;
  analyticsOptOut: boolean;
  subjectToLegalEffectiveDateWait: boolean;
}): boolean {
  const {
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  } = params;

  if (analyticsOptOut) {
    return false;
  }

  if (
    !hasAcceptedCurrentPrivacyPolicyVersion(
      dateTermsAccepted,
      acceptedPrivacyPolicyVersion
    )
  ) {
    return false;
  }

  if (subjectToLegalEffectiveDateWait && !hasPassedLegalEffectiveDate()) {
    return false;
  }

  return true;
}

/** Opted in, but account-linked capture waits until CURRENT_LEGAL_EFFECTIVE_AT. */
export function hasDeferredAccountLinkedAnalytics(params: {
  dateTermsAccepted: Date | null;
  acceptedPrivacyPolicyVersion: string | null;
  analyticsOptOut: boolean;
  subjectToLegalEffectiveDateWait: boolean;
}): boolean {
  const {
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  } = params;

  return (
    !analyticsOptOut &&
    subjectToLegalEffectiveDateWait &&
    !hasPassedLegalEffectiveDate() &&
    hasAcceptedCurrentPrivacyPolicyVersion(
      dateTermsAccepted,
      acceptedPrivacyPolicyVersion
    )
  );
}

export function shouldShowAnalyticsDeferredStartDate(params: {
  dateTermsAccepted: Date | null;
  acceptedPrivacyPolicyVersion: string | null;
  subjectToLegalEffectiveDateWait: boolean;
}): boolean {
  const {
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    subjectToLegalEffectiveDateWait
  } = params;

  return (
    subjectToLegalEffectiveDateWait &&
    !hasPassedLegalEffectiveDate() &&
    hasAcceptedCurrentPrivacyPolicyVersion(
      dateTermsAccepted,
      acceptedPrivacyPolicyVersion
    )
  );
}

export function formatLegalVersionDate(version: string): string {
  const [yearStr, monthStr, dayStr] = version.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function resolveAcceptedPrivacyPolicyVersion(
  acceptedPrivacyPolicyVersion: string | null
): string {
  return acceptedPrivacyPolicyVersion ?? LEGACY_LEGAL_VERSION;
}

export function hasAcceptedCurrentPrivacyPolicyVersion(
  dateTermsAccepted: Date | null,
  acceptedPrivacyPolicyVersion: string | null
): boolean {
  if (!dateTermsAccepted) {
    return false;
  }

  return (
    resolveAcceptedPrivacyPolicyVersion(acceptedPrivacyPolicyVersion) ===
    CURRENT_LEGAL_VERSION
  );
}

export function isLegalUpdateRequired(
  dateTermsAccepted: Date | null,
  acceptedPrivacyPolicyVersion: string | null
): boolean {
  if (!dateTermsAccepted) {
    return false;
  }

  return !hasAcceptedCurrentPrivacyPolicyVersion(
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion
  );
}
