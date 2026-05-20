-- Add organization name to feedback submissions (synced to Airtable "Organization Name" column)
ALTER TABLE public.feedback
    ADD COLUMN IF NOT EXISTS organization_name TEXT;

COMMENT ON COLUMN public.feedback.organization_name IS 'Optional organization name provided by user';
