-- Migration: Add scheduled account deletion columns to profile
-- Path A — nullable columns; synced via PowerSync schemaless JSON, no schema version bump.

alter table public.profile
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz;

comment on column public.profile.deletion_requested_at is
  'When the user requested permanent account erasure (new flow after C ships). Null for legacy soft-deletes.';

comment on column public.profile.deletion_scheduled_for is
  'UTC timestamp when the purge worker may hard-delete this account. Set only with deletion_requested_at.';
