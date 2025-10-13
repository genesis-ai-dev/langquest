-- Add template column to project table for Bible vs Unstructured project types

ALTER TABLE public.project 
ADD COLUMN IF NOT EXISTS template text 
CHECK (template IN ('unstructured', 'bible')) 
DEFAULT 'unstructured';

-- Add index for filtering by template type
CREATE INDEX IF NOT EXISTS idx_project_template ON public.project(template);

-- Update existing projects to have a template (set to unstructured as default)
UPDATE public.project 
SET template = 'unstructured' 
WHERE template IS NULL;

