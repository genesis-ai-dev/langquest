/**
 * Align with `send-email/inviteBounceGuard.ts`. Set `INVITE_MAX_OUTBOUND_SENDS` in Edge secrets.
 */
export function getMaxInviteOutboundSends(): number {
  const raw = Deno.env.get('INVITE_MAX_OUTBOUND_SENDS');
  const n = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 1 ? n : 3;
}
