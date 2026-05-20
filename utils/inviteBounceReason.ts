import type {
  inviteBounceReasonOptions,
  inviteBounceTypeOptions
} from '@/db/constants';

export type InviteBounceReason = (typeof inviteBounceReasonOptions)[number];
export type InviteBounceType = (typeof inviteBounceTypeOptions)[number];

export function classifyBounceDiagnostic(
  diagnosticCode?: string[] | null,
  message?: string | null
): InviteBounceReason | 'unknown' {
  const text = [...(diagnosticCode ?? []), message ?? '']
    .join(' ')
    .toLowerCase();

  if (!text.trim()) return 'unknown';

  if (
    /\b5\.1\.1\b/.test(text) ||
    /does not exist|no such user|nosuchuser|user unknown|unknown user|invalid recipient|recipient.*rejected|mailbox not found|address not found|undeliverable.*address/i.test(
      text
    )
  ) {
    return 'user_not_found';
  }

  if (/\b5\.2\.2\b|mailbox full|over quota|storage.*full/i.test(text)) {
    return 'mailbox_full';
  }

  if (
    /\b5\.7\.1\b|blocked|spam|policy|not permitted|access denied/i.test(text)
  ) {
    return 'rejected';
  }

  return 'unknown';
}

export function resolveInviteBounceType(bounce: {
  type?: string;
}): InviteBounceType {
  return bounce.type === 'Transient' ? 'transient' : 'permanent';
}

export function resolveInviteBounceReason(bounce: {
  type?: string;
  message?: string;
  diagnosticCode?: string[];
}): InviteBounceReason {
  const category = classifyBounceDiagnostic(
    bounce.diagnosticCode,
    bounce.message
  );
  return category === 'unknown' ? 'general' : category;
}

function parseLegacyBounceReason(
  bounceReason: string | null | undefined
): InviteBounceReason | 'unknown' {
  const r = bounceReason?.trim();
  if (!r) return 'unknown';

  const encoded = r.match(/^(?:permanent|transient):(\w+)$/i);
  if (encoded?.[1]) {
    const raw = encoded[1].toLowerCase();
    const known: InviteBounceReason[] = [
      'user_not_found',
      'mailbox_full',
      'rejected',
      'general'
    ];
    if (known.includes(raw as InviteBounceReason)) {
      return raw as InviteBounceReason;
    }
  }

  const known: InviteBounceReason[] = [
    'user_not_found',
    'mailbox_full',
    'rejected',
    'general'
  ];
  const normalized = r.toLowerCase();
  if (known.includes(normalized as InviteBounceReason)) {
    return normalized as InviteBounceReason;
  }

  return 'unknown';
}

export function getInviteBounceReason(
  bounceReason: string | null | undefined
): InviteBounceReason | 'unknown' {
  const normalized = bounceReason?.trim().toLowerCase();
  if (normalized) {
    const known: InviteBounceReason[] = [
      'user_not_found',
      'mailbox_full',
      'rejected',
      'general'
    ];
    if (known.includes(normalized as InviteBounceReason)) {
      return normalized as InviteBounceReason;
    }
  }

  return parseLegacyBounceReason(bounceReason);
}

export function isInviteBounceUserNotFound(
  bounceReason: string | null | undefined
): boolean {
  return getInviteBounceReason(bounceReason) === 'user_not_found';
}

/** Permanent bounces should not be retried from the client (transient may retry). */
export function inviteBounceBlocksRetry(
  emailStatus: string | null | undefined,
  bounceType: string | null | undefined,
  bounceReason?: string | null | undefined
): boolean {
  if (emailStatus !== 'bounced') return false;
  return bounceType?.trim().toLowerCase() !== 'transient';
}

export type InviteSendBlockedMessageKey =
  | 'inviteEmailNotFound'
  | 'inviteCannotSendDeliveryFailed'
  | 'maxInviteAttemptsReached'
  | 'emailBlacklistedForProject';

export function getInviteSendBlockedMessageKey(params: {
  emailStatus?: string | null;
  bounceType?: string | null;
  bounceReason?: string | null;
  globallySuppressed?: boolean;
}): InviteSendBlockedMessageKey {
  const category = getInviteBounceReason(params.bounceReason);

  if (params.globallySuppressed) {
    return category === 'user_not_found'
      ? 'inviteEmailNotFound'
      : 'emailBlacklistedForProject';
  }

  if (params.emailStatus === 'bounced') {
    return category === 'user_not_found'
      ? 'inviteEmailNotFound'
      : 'inviteCannotSendDeliveryFailed';
  }

  return 'maxInviteAttemptsReached';
}
