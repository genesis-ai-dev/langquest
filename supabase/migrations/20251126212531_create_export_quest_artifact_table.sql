-- Migration: Create export quest artifact table
-- Purpose: Enable exporting quests as concatenated audio artifacts for sharing and distribution
-- Tables: export_quest_artifact
-- Note: Polymorphic structure supports Bible chapters and other content types

-- ============================================================================
-- CREATE export_quest_artifact TABLE
-- ============================================================================
CREATE TABLE export_quest_artifact (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  quest_id UUID NOT NULL REFERENCES quest(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  
  -- Export artifact data
  audio_url TEXT, -- URL to concatenated MP3 (null until processing completes)
  metadata JSONB NOT NULL, -- Polymorphic metadata: manifest (technical data) + optional bible (Bible-specific metadata)
  
  -- Export type and status
  export_type TEXT NOT NULL CHECK (export_type IN ('feedback', 'distribution')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'ingested')),
  error_message TEXT, -- Error details if status='failed'
  
  -- Shareable link for feedback exports
  share_token TEXT UNIQUE, -- Unique token for public sharing
  share_expires_at TIMESTAMPTZ, -- Expiration for share token (default 7 days)
  
  -- Idempotency
  checksum TEXT NOT NULL, -- SHA256 hash of sorted source asset IDs
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_export_quest_artifact_quest_id ON export_quest_artifact(quest_id);
CREATE INDEX idx_export_quest_artifact_project_id ON export_quest_artifact(project_id);
CREATE INDEX idx_export_quest_artifact_status ON export_quest_artifact(status);
CREATE INDEX idx_export_quest_artifact_export_type ON export_quest_artifact(export_type);
CREATE INDEX idx_export_quest_artifact_checksum ON export_quest_artifact(checksum);
CREATE INDEX idx_export_quest_artifact_share_token ON export_quest_artifact(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_export_quest_artifact_created_by ON export_quest_artifact(created_by);

-- Unique constraint: one export per quest+checksum (idempotency)
CREATE UNIQUE INDEX idx_export_quest_artifact_quest_checksum ON export_quest_artifact(quest_id, checksum);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on table
ALTER TABLE export_quest_artifact ENABLE ROW LEVEL SECURITY;

-- export_quest_artifact policies
-- Users can view exports for projects they're members of
CREATE POLICY "Users can view exports for their projects"
  ON export_quest_artifact FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profile_project_link
      WHERE profile_project_link.project_id = export_quest_artifact.project_id
        AND profile_project_link.profile_id = auth.uid()
        AND profile_project_link.active = true
    )
  );

-- Users can create exports for projects they're members of
CREATE POLICY "Users can create exports for their projects"
  ON export_quest_artifact FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profile_project_link
      WHERE profile_project_link.project_id = export_quest_artifact.project_id
        AND profile_project_link.profile_id = auth.uid()
        AND profile_project_link.active = true
    )
  );

-- Users can update their own exports (for status updates, etc.)
CREATE POLICY "Users can update their own exports"
  ON export_quest_artifact FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Distribution exports require owner/admin permissions
CREATE POLICY "Owners can update distribution exports"
  ON export_quest_artifact FOR UPDATE
  USING (
    export_type = 'distribution'
    AND EXISTS (
      SELECT 1 FROM profile_project_link
      WHERE profile_project_link.project_id = export_quest_artifact.project_id
        AND profile_project_link.profile_id = auth.uid()
        AND profile_project_link.membership = 'owner'
        AND profile_project_link.active = true
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE export_quest_artifact IS 'Polymorphic export artifacts for quests - concatenated audio + metadata (supports Bible chapters and other content types)';
COMMENT ON COLUMN export_quest_artifact.metadata IS 'Polymorphic JSONB: contains manifest (technical data) and optional bible (Bible-specific metadata)';
COMMENT ON COLUMN export_quest_artifact.checksum IS 'SHA256 hash of sorted source asset IDs for idempotency';
COMMENT ON COLUMN export_quest_artifact.share_token IS 'Unique token for public sharing (feedback exports only)';
COMMENT ON COLUMN export_quest_artifact.status IS 'Export processing status: pending -> processing -> ready/failed/ingested';

