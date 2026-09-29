/// <reference types="jest" />

import {
  DEFAULT_INVITE_MAX_RESEND_ATTEMPTS,
  inviteMaySendAnotherOutboundEmail,
  isEmailSuppressionActive
} from '../inviteBounceGuard';

describe('isEmailSuppressionActive', () => {
  const now = new Date('2026-09-18T12:00:00.000Z');

  it('is inactive for a missing or deactivated row', () => {
    expect(isEmailSuppressionActive(null, now)).toBe(false);
    expect(isEmailSuppressionActive(undefined, now)).toBe(false);
    expect(
      isEmailSuppressionActive(
        {
          suppressed_at: '2026-01-01T00:00:00.000Z',
          deactivated_at: '2026-02-01T00:00:00.000Z'
        },
        now
      )
    ).toBe(false);
  });

  it('is active for a hard suppression', () => {
    expect(
      isEmailSuppressionActive(
        { suppressed_at: '2026-01-01T00:00:00.000Z' },
        now
      )
    ).toBe(true);
  });

  it('treats blank suppressed_at as inactive', () => {
    expect(isEmailSuppressionActive({ suppressed_at: '   ' }, now)).toBe(false);
  });

  it('is active for a soft suppression that has not expired', () => {
    expect(
      isEmailSuppressionActive(
        {
          soft_suppressed_at: '2026-09-17T00:00:00.000Z',
          expires_at: '2026-09-19T00:00:00.000Z'
        },
        now
      )
    ).toBe(true);
  });

  it('is inactive after a soft suppression expires', () => {
    expect(
      isEmailSuppressionActive(
        {
          soft_suppressed_at: '2026-09-01T00:00:00.000Z',
          expires_at: '2026-09-17T00:00:00.000Z'
        },
        now
      )
    ).toBe(false);
  });
});

describe('inviteMaySendAnotherOutboundEmail', () => {
  it('allows sends under the default cap', () => {
    expect(inviteMaySendAnotherOutboundEmail(0)).toBe(true);
    expect(
      inviteMaySendAnotherOutboundEmail(DEFAULT_INVITE_MAX_RESEND_ATTEMPTS - 1)
    ).toBe(true);
    expect(inviteMaySendAnotherOutboundEmail(null)).toBe(true);
  });

  it('blocks at the cap and when globally suppressed', () => {
    expect(
      inviteMaySendAnotherOutboundEmail(DEFAULT_INVITE_MAX_RESEND_ATTEMPTS)
    ).toBe(false);
    expect(inviteMaySendAnotherOutboundEmail(0, true)).toBe(false);
    expect(inviteMaySendAnotherOutboundEmail(1, false, 1)).toBe(false);
  });
});
