// Schema version tracking for migrations
// This file has no dependencies to avoid circular imports
export const APP_SCHEMA_VERSION = '2.0';

export const reasonOptions = [
  'inappropriate_content',
  'spam',
  'other'
] as const;

export const statusOptions = [
  'pending',
  'accepted',
  'declined',
  'withdrawn'
  // 'expired'
] as const;

export const templateOptions = ['unstructured', 'bible'] as const;

export const sourceOptions = ['local', 'synced', 'cloud'] as const;

export const membershipOptions = ['owner', 'member'] as const;
