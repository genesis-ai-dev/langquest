-- Migration: Create feedback table for user submissions
-- Purpose: Store user feedback that syncs to Airtable via webhook

-- Create the feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign key to profile
    profile_id UUID NOT NULL REFERENCES public.profile(id),

    -- Feedback fields
    name TEXT,
    title TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('bug', 'feature_request', 'general', 'other')),
    description TEXT NOT NULL,
    app_version TEXT
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS feedback_profile_id_idx ON public.feedback(profile_id);
CREATE INDEX IF NOT EXISTS feedback_request_type_idx ON public.feedback(request_type);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback(created_at);

-- Add comments for documentation
COMMENT ON TABLE public.feedback IS 'User-submitted feedback that syncs to Airtable';
COMMENT ON COLUMN public.feedback.profile_id IS 'User who submitted the feedback';
COMMENT ON COLUMN public.feedback.name IS 'Optional name provided by user';
COMMENT ON COLUMN public.feedback.title IS 'Short title/summary of feedback';
COMMENT ON COLUMN public.feedback.request_type IS 'Category: bug, feature_request, general, or other';
COMMENT ON COLUMN public.feedback.description IS 'Detailed feedback content (max 2000 chars enforced client-side)';
COMMENT ON COLUMN public.feedback.app_version IS 'App version at time of submission';

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own feedback
CREATE POLICY "Users can view own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = profile_id);

-- RLS Policy: Users can only insert their own feedback
CREATE POLICY "Users can insert own feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = profile_id);
