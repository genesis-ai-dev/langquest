/**
 * Client-side helpers for invite delivery / retry UI.
 *
 * Global suppression is enforced on the server (`email_suppression`).
 * Per-invite resend cap uses `INVITE_MAX_RESEND_ATTEMPTS` on the server.
 */
export const DEFAULT_INVITE_MAX_RESEND_ATTEMPTS = 3;

/** @deprecated Use DEFAULT_INVITE_MAX_RESEND_ATTEMPTS */
export const DEFAULT_INVITE_MAX_OUTBOUND_SENDS =
  DEFAULT_INVITE_MAX_RESEND_ATTEMPTS;

export function isTransientBounceReason(
  bounceReason: string | null | undefined
): boolean {
  const r = bounceReason?.trim();
  if (!r) return false;
  return /^transient\s*:/i.test(r) || /soft bounce/i.test(r);
}

export interface EmailSuppressionSnapshot {
  suppressed_at?: string | null;
  soft_suppressed_at?: string | null;
  expires_at?: string | null;
  deactivated_at?: string | null;
}

/** True when this address is globally blocked from outbound email. */
export function isEmailSuppressionActive(
  row: EmailSuppressionSnapshot | null | undefined,
  now = new Date()
): boolean {
  if (!row || row.deactivated_at) return false;
  if (row.suppressed_at?.trim()) return true;
  if (row.soft_suppressed_at?.trim() && row.expires_at) {
    return new Date(row.expires_at) > now;
  }
  return false;
}

/** True when this address is blocked for all invite emails (server `email_suppression`). */
export function inviteEmailGloballySuppressed(
  globallySuppressed: boolean | undefined
): boolean {
  return !!globallySuppressed;
}

/** Another outbound invite email is allowed for this row before per-invite cap. */
export function inviteMaySendAnotherOutboundEmail(
  count: number | null | undefined,
  emailGloballySuppressed?: boolean,
  maxSends: number = DEFAULT_INVITE_MAX_RESEND_ATTEMPTS
): boolean {
  if (inviteEmailGloballySuppressed(emailGloballySuppressed)) return false;
  return (count ?? 0) < maxSends;
}

export function inviteBouncedOutboundRetryAllowed(
  count: number | null | undefined,
  emailGloballySuppressed?: boolean,
  maxSends: number = DEFAULT_INVITE_MAX_RESEND_ATTEMPTS
): boolean {
  return inviteMaySendAnotherOutboundEmail(
    count,
    emailGloballySuppressed,
    maxSends
  );
}
