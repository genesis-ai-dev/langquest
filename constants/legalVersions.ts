/** Matches langquest.org privacy policy version slugs (YYYY-MM-DD). */
export const LEGACY_LEGAL_VERSION = '2025-04-23';
export const CURRENT_LEGAL_VERSION = '2026-07-08';

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
