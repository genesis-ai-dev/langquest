/**
 * Keep aligned with `utils/inviteBounceReason.ts`.
 */
export type InviteBounceReason =
  | 'user_not_found'
  | 'mailbox_full'
  | 'rejected'
  | 'general';

export type InviteBounceType = 'permanent' | 'transient';

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
