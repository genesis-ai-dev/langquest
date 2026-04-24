-- ============================================================================
-- Schedule FIA template refresh via pg_cron
-- ============================================================================
-- Calls the fia-refresh-templates edge function daily at 03:00 UTC.
-- Uses pg_net to make an HTTP POST to the edge function.
-- ============================================================================

-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job
SELECT cron.schedule(
  'fia-template-refresh',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/fia-refresh-templates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
