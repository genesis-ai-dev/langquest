import Airtable from 'airtable';
import { Webhook } from 'standardwebhooks';

/**
 * Supabase Edge Function: feedback-to-airtable
 *
 * This function receives webhook calls from Supabase when new feedback is inserted,
 * then forwards the data to Airtable using the official Airtable.js SDK.
 *
 * For Joel: Set these environment variables in your Supabase project:
 * - AIRTABLE_API_KEY: Your Airtable Personal Access Token
 * - AIRTABLE_BASE_ID: The ID of your Airtable base
 * - AIRTABLE_TABLE_NAME: The name of the table (default: 'Feedback')
 * - FEEDBACK_WEBHOOK_SECRET: The webhook secret for verifying requests
 *
 * Or alternatively, if you prefer a different integration pattern:
 * - Use a Database Webhook (Supabase Dashboard > Database > Webhooks)
 * - Point it to this Edge Function URL
 */

interface FeedbackRecord {
  id: string;
  profile_id: string;
  name: string | null;
  title: string;
  request_type: 'bug' | 'feature_request' | 'general' | 'other';
  description: string;
  app_version: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: FeedbackRecord;
  old_record: FeedbackRecord | null;
}

// Airtable API configuration
const AIRTABLE_API_KEY = Deno.env.get('AIRTABLE_API_KEY');
const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');
const AIRTABLE_TABLE_NAME = Deno.env.get('AIRTABLE_TABLE_NAME');
const WEBHOOK_SECRET = Deno.env.get('FEEDBACK_WEBHOOK_SECRET');

// Initialize Airtable client
let airtableBase: Airtable.Base | null = null;
if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
  const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
  airtableBase = airtable.base(AIRTABLE_BASE_ID);
}

/**
 * Formats the request type for display in Airtable
 */
function formatRequestType(type: string): string {
  const typeMap: Record<string, string> = {
    bug: 'Bug Report',
    feature_request: 'Feature Request',
    general: 'General Feedback',
    other: 'Other'
  };
  return typeMap[type] || type;
}

/**
 * Sends feedback data to Airtable using the Airtable.js SDK
 * For Joel: Modify this function to match your Airtable schema
 */
async function sendToAirtable(feedback: FeedbackRecord): Promise<void> {
  if (!airtableBase) {
    console.warn('[feedback-to-airtable] Airtable not configured - skipping');
    return;
  }

  // Map feedback fields to Airtable fields
  // For Joel: Adjust these field names to match your Airtable table
  const airtableFields = {
    // Required fields
    Title: feedback.title,
    Description: feedback.description,
    'Request Type': formatRequestType(feedback.request_type),
    'Submitted At': feedback.created_at,

    // Optional fields - adjust names as needed
    Name: feedback.name || 'Anonymous',
    'App Version': feedback.app_version || 'unknown',
    'User ID': feedback.profile_id,
    'Feedback ID': feedback.id
  };

  try {
    // Airtable.js SDK expects { fields: {...} } when creating a record
    const record = await airtableBase(AIRTABLE_TABLE_NAME).create({
      fields: airtableFields
    });
    console.log(
      '[feedback-to-airtable] Successfully sent to Airtable:',
      record.getId()
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    throw new Error(`Airtable API error: ${error}`);
  }
}

/**
 * Main handler for the Edge Function
 */
Deno.serve(async (req) => {
  console.log('[feedback-to-airtable] Received request');

  try {
    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const payload = await req.text();
      const headers = Object.fromEntries(req.headers.entries());

      try {
        const wh = new Webhook(WEBHOOK_SECRET);
        wh.verify(payload, headers);
      } catch (err) {
        console.error(
          '[feedback-to-airtable] Webhook verification failed:',
          err
        );
        return new Response('Unauthorized', { status: 401 });
      }

      // Parse the verified payload
      const body = JSON.parse(payload) as WebhookPayload;

      // Only process INSERT events
      if (body.type !== 'INSERT' || body.table !== 'feedback') {
        console.log(
          '[feedback-to-airtable] Ignoring event:',
          body.type,
          body.table
        );
        return new Response('Ignored', { status: 200 });
      }

      // Send to Airtable
      await sendToAirtable(body.record);

      return new Response(
        JSON.stringify({ success: true, message: 'Feedback sent to Airtable' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else {
      // No webhook secret configured - process directly (for testing)
      const body = (await req.json()) as WebhookPayload;

      if (body.type !== 'INSERT' || body.table !== 'feedback') {
        console.log(
          '[feedback-to-airtable] Ignoring event:',
          body.type,
          body.table
        );
        return new Response('Ignored', { status: 200 });
      }

      await sendToAirtable(body.record);

      return new Response(
        JSON.stringify({ success: true, message: 'Feedback sent to Airtable' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('[feedback-to-airtable] Error processing request:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Setup instructions for Joel:
 *
 * 1. Deploy this function:
 *    supabase functions deploy feedback-to-airtable
 *
 * 2. Set environment variables in Supabase Dashboard:
 *    - AIRTABLE_API_KEY: Your Airtable Personal Access Token
 *    - AIRTABLE_BASE_ID: Your Airtable base ID (starts with 'app')
 *    - AIRTABLE_TABLE_NAME: Name of the table (default: 'Feedback')
 *    - FEEDBACK_WEBHOOK_SECRET: Random secret for webhook verification
 *
 * 3. Set up Database Webhook in Supabase:
 *    - Go to Dashboard > Database > Webhooks
 *    - Create a new webhook on the 'feedback' table
 *    - Event: INSERT
 *    - URL: https://<project-ref>.supabase.co/functions/v1/feedback-to-airtable
 *    - Headers: Include the webhook secret if configured
 *
 * 4. Airtable Table Schema (suggested):
 *    - Title (Single line text)
 *    - Description (Long text)
 *    - Request Type (Single select: Bug Report, Feature Request, General Feedback, Other)
 *    - Name (Single line text)
 *    - App Version (Single line text)
 *    - User ID (Single line text)
 *    - Feedback ID (Single line text)
 *    - Submitted At (Date time)
 */
