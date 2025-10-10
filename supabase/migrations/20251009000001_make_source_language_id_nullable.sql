-- Make source_language_id nullable since we now use project_language_link table
-- This allows new projects to be created without source_language_id
-- Legacy projects keep their source_language_id for backwards compatibility

ALTER TABLE public.project 
ALTER COLUMN source_language_id DROP NOT NULL;

-- Add comment explaining the transition
COMMENT ON COLUMN public.project.source_language_id IS 
'DEPRECATED: Use project_language_link table instead. This column is kept for backwards compatibility with existing projects but is nullable for new projects.';


