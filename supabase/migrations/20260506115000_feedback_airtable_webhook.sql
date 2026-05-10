-- Migration: Setup webhook trigger for feedback to Airtable
-- Version: 2.4 (no schema change, adds webhook integration)
-- Purpose: Trigger webhook when feedback is inserted

-- Note: This is an optional migration. Webhooks can also be configured via Supabase Dashboard.
-- This SQL uses Supabase Vault for secure configuration storage.

-- IMPORTANT: This requires the pg_net extension (available on Supabase)

-- Create the webhook trigger function
CREATE OR REPLACE FUNCTION public.trigger_feedback_webhook()
RETURNS TRIGGER AS $$
DECLARE
    supabase_url TEXT;
    webhook_url TEXT;
    function_secret TEXT;
    payload JSONB;
    headers JSONB;
BEGIN
    -- Get supabase_url from vault.decrypted_secrets (NOT vault.get_secret)
    BEGIN
        SELECT decrypted_secret INTO supabase_url
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_url'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        supabase_url := NULL;
    END;

    -- Get function secret from vault.decrypted_secrets (required for auth)
    BEGIN
        SELECT decrypted_secret INTO function_secret
        FROM vault.decrypted_secrets
        WHERE name = 'feedback_function_secret'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        function_secret := NULL;
    END;

    -- Skip if supabase_url not configured
    IF supabase_url IS NULL OR supabase_url = '' THEN
        RAISE LOG '[feedback_webhook] supabase_url not configured in vault, skipping';
        RETURN NEW;
    END IF;

    -- Skip if function_secret not configured (required for authentication)
    IF function_secret IS NULL OR function_secret = '' THEN
        RAISE LOG '[feedback_webhook] feedback_function_secret not configured in vault, skipping';
        RETURN NEW;
    END IF;

    -- Construct the full webhook URL
    webhook_url := supabase_url || '/functions/v1/feedback-to-airtable';

    -- Build the payload
    payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW),
        'old_record', NULL
    );

    -- Build headers with simple secret verification
    headers := jsonb_build_object(
        'Content-Type', 'application/json'
    );

    -- Add X-Function-Secret header if configured
    IF function_secret IS NOT NULL AND function_secret != '' THEN
        headers := headers || jsonb_build_object(
            'X-Function-Secret', function_secret
        );
    END IF;

    -- Send async HTTP request using pg_net
    PERFORM net.http_post(
        url := webhook_url,
        headers := headers,
        body := payload
    );

    RAISE LOG '[feedback_webhook] Queued webhook for feedback id=%', NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS feedback_webhook_trigger ON public.feedback;
CREATE TRIGGER feedback_webhook_trigger
    AFTER INSERT ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_feedback_webhook();

-- Alternative: Use Supabase Database Webhooks (recommended)
-- Go to Supabase Dashboard > Database > Webhooks
-- Create webhook on 'feedback' table, INSERT event
-- URL: https://<project-ref>.supabase.co/functions/v1/feedback-to-airtable

COMMENT ON FUNCTION public.trigger_feedback_webhook() IS
    'Trigger function to send feedback to Airtable. Uses vault.decrypted_secrets to get supabase_url and feedback_function_secret (both REQUIRED). Sends X-Function-Secret header for authentication.';
