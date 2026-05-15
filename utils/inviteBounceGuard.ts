/**
 * Client-side helpers for invite delivery / retry UI.
 *
 * Hard cap and global suppression are enforced on the server (`INVITE_MAX_OUTBOUND_SENDS`,
 * `invite_email_suppression`). Defaults here should match server defaults when env is unset.
 */
export const DEFAULT_INVITE_MAX_OUTBOUND_SENDS = 3;

export function isTransientBounceReason(
  bounceReason: string | null | undefined
): boolean {
  const r = bounceReason?.trim();
  if (!r) return false;
  return /^transient\s*:/i.test(r) || /soft bounce/i.test(r);
}

export function inviteDeliverySuppressed(
  deliverySuppressedAt: string | null | undefined
): boolean {
  return !!deliverySuppressedAt?.trim();
}

/** True when this address is blocked for all invite emails (server `invite_email_suppression`). */
export function inviteEmailGloballySuppressed(
  globallySuppressed: boolean | undefined
): boolean {
  return !!globallySuppressed;
}

/** Another outbound invite email is allowed for this row before per-invite cap (transient path). */
export function inviteMaySendAnotherOutboundEmail(
  count: number | null | undefined,
  deliverySuppressedAt: string | null | undefined,
  emailGloballySuppressed?: boolean,
  maxSends: number = DEFAULT_INVITE_MAX_OUTBOUND_SENDS
): boolean {
  if (inviteEmailGloballySuppressed(emailGloballySuppressed)) return false;
  if (inviteDeliverySuppressed(deliverySuppressedAt)) return false;
  return (count ?? 0) < maxSends;
}

export function inviteBouncedOutboundRetryAllowed(
  count: number | null | undefined,
  deliverySuppressedAt: string | null | undefined,
  emailGloballySuppressed?: boolean,
  maxSends: number = DEFAULT_INVITE_MAX_OUTBOUND_SENDS
): boolean {
  return inviteMaySendAnotherOutboundEmail(
    count,
    deliverySuppressedAt,
    emailGloballySuppressed,
    maxSends
  );
}
