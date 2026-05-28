-- Drop unused name column from feedback (username comes from profile via Airtable edge function)
ALTER TABLE public.feedback
  DROP COLUMN IF EXISTS name;