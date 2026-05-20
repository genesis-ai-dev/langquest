// Schema version tracking for migrations
// This file has no dependencies to avoid circular imports
export const APP_SCHEMA_VERSION = '2.3';

export const reasonOptions = [
  'inappropriate_content',
  'spam',
  'other'
] as const;

export const statusOptions = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired'
] as const;

export const templateOptions = ['unstructured', 'bible', 'fia'] as const;
export const versificationTemplateOptions = ['protestant'] as const;

export const sourceOptions = ['local', 'synced', 'cloud'] as const;

export const membershipOptions = ['owner', 'member'] as const;

export const contentTypeOptions = [
  'source',
  'translation',
  'transcription'
] as const;

export const matchedOnOptions = ['name', 'alias', 'iso_code'] as const;

export const requestTypeOptions = [
  'bug',
  'feature_request',
  'general',
  'other'
] as const;

export const emailStatusOptions = [
  'sent',
  'delivered',
  'bounced',
  'complained'
] as const;

/** Resend bounce severity (stored on invite.bounce_type when email_status = bounced). */
export const inviteBounceTypeOptions = ['permanent', 'transient'] as const;

/** Classified invite delivery failure (stored on invite.bounce_reason). */
export const inviteBounceReasonOptions = [
  'user_not_found',
  'mailbox_full',
  'rejected',
  'general'
] as const;
