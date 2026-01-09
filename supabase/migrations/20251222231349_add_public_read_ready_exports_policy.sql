-- Migration: Add public read ready exports policy
-- Purpose: Allow anonymous users to read export_quest_artifact records with status='ready'
-- Tables: export_quest_artifact
-- Note: This enables public access to ready exports for sharing/distribution without authentication

-- ============================================================================
-- RLS POLICY
-- ============================================================================

-- Drop policy if it exists to ensure idempotency
drop policy if exists "public read ready exports" on public.export_quest_artifact;

-- Allow anonymous users to read exports that are ready
-- Rationale: Completed export artifacts (status='ready') should be publicly accessible
-- for sharing and distribution purposes. This policy enables unauthenticated users
-- to access ready exports via share tokens or direct links, while maintaining security
-- by only exposing completed exports (not pending, processing, or failed ones).
-- This complements the existing authenticated policy that allows project members
-- to view all exports for their projects.
create policy "public read ready exports"
  on public.export_quest_artifact
  for select
  to anon
  using (status = 'ready');
