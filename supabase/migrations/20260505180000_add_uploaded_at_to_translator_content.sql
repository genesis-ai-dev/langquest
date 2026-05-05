-- Migration: Add uploaded_at column to translator-content tables
-- Version: 2.3 → 2.4 (minor bump - additive change)
-- Purpose: Track server-confirmed upload time for translator-payment reporting
--
-- Tables affected:
--   - asset_content_link (translation/transcription content)
--   - vote (peer review activity)
--   - asset (field-created assets)
--
-- Design decisions:
--   - Column is nullable: no backfill for existing rows (as per contract)
--   - Default is now() at column level: no trigger, no app-level write
--   - Populated by Postgres on INSERT: clients MUST NOT include in mutation payloads
--   - Independent of created_at/last_updated: reflects server clock only
--   - Immutable after INSERT: no UPDATE code path modifies this column

-- Add uploaded_at to asset_content_link table
alter table asset_content_link
  add column if not exists uploaded_at timestamptz null default now();

comment on column asset_content_link.uploaded_at is
  'Server-confirmed upload time for payment reporting. Set by DEFAULT now() on INSERT. Clients must not write this column.';

-- Add uploaded_at to vote table
alter table vote
  add column if not exists uploaded_at timestamptz null default now();

comment on column vote.uploaded_at is
  'Server-confirmed upload time for payment reporting. Set by DEFAULT now() on INSERT. Clients must not write this column.';

-- Add uploaded_at to asset table
alter table asset
  add column if not exists uploaded_at timestamptz null default now();

comment on column asset.uploaded_at is
  'Server-confirmed upload time for payment reporting. Set by DEFAULT now() on INSERT. Clients must not write this column.';
