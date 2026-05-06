-- Migration: Setup webhook trigger for feedback to Airtable
-- Version: 2.4 (no schema change, adds webhook integration)
-- Purpose: Trigger webhook when feedback is inserted

-- Note: This is an optional migration. Webhooks can also be configured via Supabase Dashboard.
-- This SQL uses Supabase Vault for secure configuration storage.

-- IMPORTANT: This requires the pg_net extension (available on Supabase)
-- Configure webhook secret via Supabase Vault:
--   SELECT vault.set_secret('feedback_webhook_secret', 'your-secret-here');
-- The webhook URL is constructed dynamically from the supabase_url vault secret.

-- Create the webhook trigger function
CREATE OR REPLACE FUNCTION public.trigger_feedback_webhook()
RETURNS TRIGGER AS $$
DECLARE
    supabase_url TEXT;
    webhook_url TEXT;
    webhook_secret TEXT;
    payload JSONB;
    headers JSONB;
BEGIN
    -- Get supabase_url from vault (already configured for other functions)
    -- Constructs the full webhook URL dynamically: {supabase_url}/functions/v1/feedback-to-airtable
    BEGIN
        supabase_url := vault.get_secret('supabase_url');
    EXCEPTION WHEN OTHERS THEN
        supabase_url := NULL;
    END;

    -- Get webhook secret from vault (optional, for signature verification)
    BEGIN
        webhook_secret := vault.get_secret('feedback_webhook_secret');
    EXCEPTION WHEN OTHERS THEN
        webhook_secret := NULL;
    END;

    -- Skip if supabase_url not configured
    IF supabase_url IS NULL OR supabase_url = '' THEN
        RAISE LOG '[feedback_webhook] supabase_url not configured in vault, skipping';
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

    -- Build headers
    headers := jsonb_build_object(
        'Content-Type', 'application/json'
    );

    -- Add webhook signature if secret is configured
    IF webhook_secret IS NOT NULL AND webhook_secret != '' THEN
        headers := headers || jsonb_build_object(
            'webhook-signature', 't=' || extract(epoch from now())::text || ',' ||
                encode(hmac(payload::text, webhook_secret, 'sha256'), 'hex')
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
    'Trigger function to send feedback to Airtable via webhook. Uses supabase_url from vault to construct the webhook URL dynamically. Optionally set feedback_webhook_secret in vault for signature verification. Or use Dashboard webhooks instead.';
