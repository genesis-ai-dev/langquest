-- ============================================================================
-- Migration: Add uploaded_at tracking columns to asset and asset_content_link
-- ============================================================================
--
-- PURPOSE:
-- Add nullable uploaded_at timestamp field to asset and asset_content_link
-- tables with INSERT triggers that populate the field with the current
-- timestamp when content is uploaded. This enables tracking when content
-- is actually uploaded to the server for translator payment management.
--
-- TABLES AFFECTED:
-- - asset (and synced variants: asset_synced, asset_local)
-- - asset_content_link (and synced variants: asset_content_link_synced, asset_content_link_local)
--
-- DESIGN DECISIONS:
-- - Column is nullable: existing rows remain NULL (no backfill)
-- - Server-side trigger: ensures uploaded_at is set whenever server receives INSERT
-- - timestamptz type: follows Supabase best practices for timezone-aware timestamps
-- - now() function: returns current timestamp with timezone
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- PART 1: Add uploaded_at column to asset table
-- ============================================================================

-- Add column WITHOUT default to avoid backfilling existing rows
alter table public.asset add column uploaded_at timestamptz;

-- ============================================================================
-- PART 2: Add uploaded_at column to asset_content_link table
-- ============================================================================

alter table public.asset_content_link add column uploaded_at timestamptz;

-- ============================================================================
-- PART 3: Create INSERT trigger function for asset
-- ============================================================================

-- Trigger function sets uploaded_at to current timestamp for all INSERTs
-- This ensures the field is populated even if client explicitly passes NULL
create or replace function public.set_asset_uploaded_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.uploaded_at = now();
    return new;
end;
$$;

-- Drop trigger if exists for idempotency
drop trigger if exists trigger_set_asset_uploaded_at on public.asset;

-- Create trigger that fires BEFORE INSERT
create trigger trigger_set_asset_uploaded_at
    before insert on public.asset
    for each row
    execute function public.set_asset_uploaded_at();

-- ============================================================================
-- PART 4: Create INSERT trigger function for asset_content_link
-- ============================================================================

create or replace function public.set_asset_content_link_uploaded_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.uploaded_at = now();
    return new;
end;
$$;

-- Drop trigger if exists for idempotency
drop trigger if exists trigger_set_asset_content_link_uploaded_at on public.asset_content_link;

-- Create trigger that fires BEFORE INSERT
create trigger trigger_set_asset_content_link_uploaded_at
    before insert on public.asset_content_link
    for each row
    execute function public.set_asset_content_link_uploaded_at();

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
--
-- TRIGGER BEHAVIOR:
--
-- BEFORE INSERT trigger ensures uploaded_at is always set to now() when
-- the server receives the INSERT, regardless of what value the client sends.
-- This accurately tracks when content was actually uploaded to the server.
--
-- SYNCED TABLE VARIANTS:
--
-- The synced variants (asset_synced, asset_content_link_synced) and local
-- variants (asset_local, asset_content_link_local) will inherit the same
-- column through PowerSync's schema replication. The triggers only exist
-- on the base tables since that's where INSERTs from the client are received.
--
-- NO SCHEMA VERSION BUMP NEEDED:
--
-- Per migration rules, no APP_SCHEMA_VERSION bump is required because:
-- - This is a nullable column addition
-- - PowerSync handles schema changes automatically for synced tables
-- - The column is populated server-side via trigger
-- - Existing rows remain NULL (no backfill needed)
--
-- CLIENT-SIDE SCHEMA:
--
-- The Drizzle schema already includes uploaded_at as text() (nullable) in:
-- - createAssetTable() - db/drizzleSchemaColumns.ts
-- - createAssetContentLinkTable() - db/drizzleSchemaColumns.ts
--
-- ============================================================================
