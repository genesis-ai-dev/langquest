/**
 * Server-side invite delivery guards. Must stay aligned with `utils/inviteBounceGuard.ts` defaults.
 *
 * Set `INVITE_MAX_OUTBOUND_SENDS` in Supabase Edge secrets (integer, >= 1). Defaults to 3.
 */
export function getMaxInviteOutboundSends(): number {
  const raw = Deno.env.get('INVITE_MAX_OUTBOUND_SENDS');
  const n = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 1 ? n : 3;
}

export function inviteDeliverySuppressed(
  deliverySuppressedAt: string | null | undefined
): boolean {
  return !!deliverySuppressedAt?.trim();
}

export function isTransientBounceReason(
  bounceReason: string | null | undefined
): boolean {
  const r = bounceReason?.trim();
  if (!r) return false;
  return /^transient\s*:/i.test(r) || /soft bounce/i.test(r);
}

export function inviteMaySendAnotherOutboundEmail(
  count: number | null | undefined,
  deliverySuppressedAt: string | null | undefined,
  maxSends: number
): boolean {
  if (inviteDeliverySuppressed(deliverySuppressedAt)) return false;
  return (count ?? 0) < maxSends;
}
