/**
 * Server-side invite delivery guards. Must stay aligned with `utils/inviteBounceGuard.ts` defaults.
 *
 * Set `INVITE_MAX_RESEND_ATTEMPTS` in Supabase Edge secrets (integer, >= 1). Defaults to 3.
 * Falls back to legacy `INVITE_MAX_OUTBOUND_SENDS` if unset.
 */
export function getMaxInviteResendAttempts(): number {
  const raw =
    Deno.env.get('INVITE_MAX_RESEND_ATTEMPTS') ??
    Deno.env.get('INVITE_MAX_OUTBOUND_SENDS');
  const n = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 1 ? n : 3;
}

export function inviteMaySendAnotherOutboundEmail(
  count: number | null | undefined,
  emailGloballySuppressed: boolean,
  maxSends: number
): boolean {
  if (emailGloballySuppressed) return false;
  return (count ?? 0) < maxSends;
}
