/// <reference types="jest" />

import { formatRelativeDate, isExpiredByLastUpdated } from '../dateUtils';

describe('isExpiredByLastUpdated', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is false inside seven days and true after', () => {
    expect(isExpiredByLastUpdated('2026-09-11T12:00:00.000Z')).toBe(false);
    expect(isExpiredByLastUpdated('2026-09-11T11:59:59.000Z')).toBe(true);
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses SQLite space timestamps as UTC', () => {
    expect(formatRelativeDate('2026-09-18 11:30:00')).toBe('30 minutes ago');
  });

  it('keeps a timezone suffix instead of appending Z', () => {
    expect(formatRelativeDate('2026-09-18 10:00:00+00:00')).toBe('2 hours ago');
  });

  it('uses hour, day, and month tiers', () => {
    expect(formatRelativeDate('2026-09-18T11:00:00.000Z')).toBe('1 hour ago');
    expect(formatRelativeDate('2026-09-16T12:00:00.000Z')).toBe('2 days ago');
    expect(formatRelativeDate('2026-08-18T12:00:00.000Z')).toBe('1 month ago');
    expect(formatRelativeDate('2026-07-18T12:00:00.000Z')).toBe('2 months ago');
  });

  it('falls back to a locale date after a year', () => {
    expect(formatRelativeDate('2025-08-01T12:00:00.000Z')).toBe('Aug 1, 2025');
  });
});
