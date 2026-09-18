/// <reference types="jest" />

import { membershipRequestUiStatus } from '../requestStatus';

describe('membershipRequestUiStatus', () => {
  it('returns null when there is no request', () => {
    expect(membershipRequestUiStatus(null)).toBeNull();
    expect(membershipRequestUiStatus(undefined)).toBeNull();
  });

  it('returns pending when the request is pending and not expired', () => {
    expect(
      membershipRequestUiStatus(
        { status: 'pending', last_updated: '2026-09-17T00:00:00.000Z' },
        () => false
      )
    ).toBe('pending');
  });

  it('returns expired when a pending request is past the last-updated window', () => {
    expect(
      membershipRequestUiStatus(
        { status: 'pending', last_updated: '2026-01-01T00:00:00.000Z' },
        () => true
      )
    ).toBe('expired');
  });

  it('uses the 7-day last-updated window by default', () => {
    const eightDaysAgo = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000
    ).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    expect(
      membershipRequestUiStatus({
        status: 'pending',
        last_updated: eightDaysAgo
      })
    ).toBe('expired');
    expect(
      membershipRequestUiStatus({
        status: 'pending',
        last_updated: yesterday
      })
    ).toBe('pending');
  });

  it('does not expire a denied or approved request', () => {
    expect(
      membershipRequestUiStatus(
        { status: 'denied', last_updated: '2026-01-01T00:00:00.000Z' },
        () => true
      )
    ).toBe('denied');
    expect(
      membershipRequestUiStatus(
        { status: 'approved', last_updated: '2026-01-01T00:00:00.000Z' },
        () => true
      )
    ).toBe('approved');
  });
});
