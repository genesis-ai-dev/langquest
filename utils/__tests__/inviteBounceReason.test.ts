/// <reference types="jest" />

import {
  classifyBounceDiagnostic,
  getInviteBounceReason,
  getInviteSendBlockedMessageKey,
  inviteBounceBlocksRetry,
  resolveInviteBounceReason,
  resolveInviteBounceType
} from '../inviteBounceReason';

describe('classifyBounceDiagnostic', () => {
  it('maps 5.1.1 and unknown-user text to user_not_found', () => {
    expect(classifyBounceDiagnostic(['5.1.1'])).toBe('user_not_found');
    expect(classifyBounceDiagnostic(null, 'user unknown')).toBe(
      'user_not_found'
    );
    expect(classifyBounceDiagnostic(undefined, 'mailbox not found')).toBe(
      'user_not_found'
    );
  });

  it('maps 5.2.2 and mailbox-full text to mailbox_full', () => {
    expect(classifyBounceDiagnostic(['5.2.2'])).toBe('mailbox_full');
    expect(classifyBounceDiagnostic(null, 'mailbox full')).toBe('mailbox_full');
    expect(classifyBounceDiagnostic(undefined, 'over quota')).toBe(
      'mailbox_full'
    );
  });

  it('maps 5.7.1 and spam/policy text to rejected', () => {
    expect(classifyBounceDiagnostic(['5.7.1'])).toBe('rejected');
    expect(classifyBounceDiagnostic(null, 'blocked as spam')).toBe('rejected');
    expect(classifyBounceDiagnostic(undefined, 'access denied')).toBe(
      'rejected'
    );
  });

  it('returns unknown for empty or unmatched diagnostics', () => {
    expect(classifyBounceDiagnostic()).toBe('unknown');
    expect(classifyBounceDiagnostic([], '')).toBe('unknown');
    expect(classifyBounceDiagnostic(['4.4.1'], 'try later')).toBe('unknown');
  });
});

describe('resolveInviteBounceType', () => {
  it('maps Transient to transient and everything else to permanent', () => {
    expect(resolveInviteBounceType({ type: 'Transient' })).toBe('transient');
    expect(resolveInviteBounceType({ type: 'Permanent' })).toBe('permanent');
    expect(resolveInviteBounceType({})).toBe('permanent');
  });
});

describe('resolveInviteBounceReason', () => {
  it('maps classified diagnostics and falls back to general', () => {
    expect(
      resolveInviteBounceReason({
        diagnosticCode: ['5.1.1'],
        message: 'no such user'
      })
    ).toBe('user_not_found');
    expect(resolveInviteBounceReason({ message: 'try later' })).toBe('general');
  });
});

describe('getInviteBounceReason', () => {
  it('accepts known reasons and legacy encoded values', () => {
    expect(getInviteBounceReason('user_not_found')).toBe('user_not_found');
    expect(getInviteBounceReason('permanent:mailbox_full')).toBe(
      'mailbox_full'
    );
    expect(getInviteBounceReason('transient:rejected')).toBe('rejected');
    expect(getInviteBounceReason('general')).toBe('general');
  });

  it('returns unknown for empty, junk, and unknown encoded tags', () => {
    expect(getInviteBounceReason(null)).toBe('unknown');
    expect(getInviteBounceReason('')).toBe('unknown');
    expect(getInviteBounceReason('permanent:not_a_reason')).toBe('unknown');
    expect(getInviteBounceReason('smtp-noise')).toBe('unknown');
  });
});

describe('inviteBounceBlocksRetry', () => {
  it('blocks permanent bounced mail and allows transient retries', () => {
    expect(inviteBounceBlocksRetry('bounced', 'permanent')).toBe(true);
    expect(inviteBounceBlocksRetry('bounced', 'Permanent', 'general')).toBe(
      true
    );
    expect(inviteBounceBlocksRetry('bounced', 'transient')).toBe(false);
    expect(inviteBounceBlocksRetry('bounced', ' Transient ')).toBe(false);
    expect(inviteBounceBlocksRetry('sent', 'permanent')).toBe(false);
    expect(inviteBounceBlocksRetry('bounced', null)).toBe(true);
  });
});

describe('getInviteSendBlockedMessageKey', () => {
  it('uses not-found copy for globally suppressed unknown addresses', () => {
    expect(
      getInviteSendBlockedMessageKey({
        bounceReason: 'user_not_found',
        globallySuppressed: true
      })
    ).toBe('inviteEmailNotFound');
  });

  it('uses project blacklist copy for other global suppressions', () => {
    expect(
      getInviteSendBlockedMessageKey({
        bounceReason: 'rejected',
        globallySuppressed: true
      })
    ).toBe('emailBlacklistedForProject');
  });

  it('maps bounced status to delivery or not-found copy', () => {
    expect(
      getInviteSendBlockedMessageKey({
        emailStatus: 'bounced',
        bounceReason: 'user_not_found'
      })
    ).toBe('inviteEmailNotFound');
    expect(
      getInviteSendBlockedMessageKey({
        emailStatus: 'bounced',
        bounceReason: 'mailbox_full'
      })
    ).toBe('inviteDeliveryFailed');
  });

  it('falls back to max attempts when not bounced or suppressed', () => {
    expect(getInviteSendBlockedMessageKey({})).toBe('maxInviteAttemptsReached');
  });
});
