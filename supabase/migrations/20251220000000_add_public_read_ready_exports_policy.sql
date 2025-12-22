-- Migration: Add public read ready exports policy
-- Purpose: Allow anonymous users to read export_quest_artifact records with status='ready'
-- Tables: export_quest_artifact
-- Note: This enables public access to ready exports for sharing/distribution

-- ============================================================================
-- RLS POLICY
-- ============================================================================

-- Allow anonymous users to read exports that are ready
-- This enables public sharing of completed export artifacts
CREATE POLICY "public read ready exports"
  ON public.export_quest_artifact
  FOR SELECT
  TO anon
  USING (status = 'ready');
