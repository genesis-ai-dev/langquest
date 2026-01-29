-- Migration: Add metadata field to asset table
-- Version: 2.0 → 2.1
-- Purpose: Store JSON metadata for asset-specific data (e.g., verse ranges for Bible projects)

-- Add metadata column to asset table
alter table asset
  add column if not exists metadata text;

-- Add comment describing the field
comment on column asset.metadata is 'JSON metadata for asset-specific data (e.g., {"verse": {"from": 1, "to": 3}})';

