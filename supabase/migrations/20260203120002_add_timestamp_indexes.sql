-- ============================================================================
-- Migration: Add timestamp indexes to asset and asset_content_link tables
-- ============================================================================
--
-- PURPOSE:
-- Adds indexes on created_at and last_updated columns for better query
-- performance when filtering or sorting by timestamps.
--
-- AFFECTED TABLES:
-- - asset (created_at, last_updated)
-- - asset_content_link (created_at, last_updated)
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1. Add indexes to asset table
-- ============================================================================

create index if not exists idx_asset_created_at
  on asset (created_at);

create index if not exists idx_asset_last_updated
  on asset (last_updated);

-- ============================================================================
-- 2. Add indexes to asset_content_link table
-- ============================================================================

create index if not exists idx_asset_content_link_created_at
  on asset_content_link (created_at);

create index if not exists idx_asset_content_link_last_updated
  on asset_content_link (last_updated);


