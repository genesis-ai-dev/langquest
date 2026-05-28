import { createClient } from '@supabase/supabase-js';
import Airtable from 'airtable';

/**
 * Supabase Edge Function: feedback-to-airtable
 *
 * This function receives webhook calls from Supabase when new feedback is inserted,
 * then forwards the data to Airtable using the official Airtable.js SDK.
 *
 * Environment variables to set in your Supabase project:
 * - AIRTABLE_API_KEY: Your Airtable Personal Access Token
 * - AIRTABLE_BASE_ID: The ID of your Airtable base
 * - AIRTABLE_TABLE_NAME: The name of the table (default: 'Feedback')
 * - FEEDBACK_FUNCTION_SECRET: Secret for simple auth via X-Feedback-Secret header
 *
 * Or alternatively, if you prefer a different integration pattern:
 * - Use a Database Webhook (Supabase Dashboard > Database > Webhooks)
 * - Point it to this Edge Function URL
 */

interface FeedbackRecord {
  id: string;
  profile_id: string;
  title: string;
  request_type: 'bug' | 'feature_request' | 'general' | 'other';
  description: string;
  organization_name: string | null;
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
const FUNCTION_SECRET = Deno.env.get('FEEDBACK_FUNCTION_SECRET');

// Supabase configuration (for looking up usernames)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Airtable client
let airtableBase: Airtable.Base | null = null;
if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
  const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
  airtableBase = airtable.base(AIRTABLE_BASE_ID);
}

// Initialize Supabase client (for username lookup)
let supabase: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Fetches the username and email from Supabase profile table using profile_id
 * Returns null if not found or on error
 */
async function getUserInfoFromProfile(
  profileId: string
): Promise<{ username: string | null; email: string | null } | null> {
  if (!supabase) {
    console.warn(
      '[feedback-to-airtable] Supabase client not configured, skipping profile lookup'
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profile')
      .select('username, email')
      .eq('id', profileId)
      .single();

    if (error) {
      console.warn(
        '[feedback-to-airtable] Error fetching profile:',
        error.message
      );
      return null;
    }

    return { username: data?.username || null, email: data?.email || null };
  } catch (err) {
    console.warn('[feedback-to-airtable] Exception fetching profile:', err);
    return null;
  }
}

/**
 * Formats the request type to match Airtable single-select values exactly
 * These must match the existing options in the Airtable "Request Type" field
 */
function formatRequestType(type: string): string {
  const typeMap: Record<string, string> = {
    bug: '🐞 Bug',
    feature_request: '✨ Feature',
    general: '💬 General',
    other: '📝 Other'
  };
  return typeMap[type] || type;
}

interface AirtableFieldSchema {
  id: string;
  name: string;
  type?: string;
}

/**
 * Fetches table schema from Airtable Metadata API and logs all field names.
 * Requires PAT scope: schema.bases:read
 */
async function logAirtableTableFields(
  fieldsToSubmit: Record<string, unknown>
): Promise<void> {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    console.warn(
      '[feedback-to-airtable] Cannot fetch schema — missing API key, base ID, or table name'
    );
    return;
  }

  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[feedback-to-airtable] Schema fetch failed (${res.status}):`,
        body
      );
      return;
    }

    const data = (await res.json()) as {
      tables?: Array<{ name: string; fields?: AirtableFieldSchema[] }>;
    };

    const table = data.tables?.find((t) => t.name === AIRTABLE_TABLE_NAME);
    if (!table) {
      console.error(
        `[feedback-to-airtable] Table "${AIRTABLE_TABLE_NAME}" not found. Available tables:`,
        data.tables?.map((t) => t.name) ?? []
      );
      return;
    }

    const airtableFieldNames = (table.fields ?? []).map((f) => f.name);
    const submitKeys = Object.keys(fieldsToSubmit);

    console.log(
      `[feedback-to-airtable] Airtable table "${AIRTABLE_TABLE_NAME}" fields:`,
      JSON.stringify(
        (table.fields ?? []).map((f) => ({ name: f.name, type: f.type })),
        null,
        2
      )
    );
    console.log('[feedback-to-airtable] Field names only:', airtableFieldNames);
    console.log('[feedback-to-airtable] Fields we are submitting:', submitKeys);

    const unknown = submitKeys.filter((k) => !airtableFieldNames.includes(k));
    if (unknown.length > 0) {
      console.warn(
        '[feedback-to-airtable] Unknown field names (not in Airtable):',
        unknown
      );
    }
  } catch (err) {
    console.error('[feedback-to-airtable] Schema fetch exception:', err);
  }
}

/**
 * Sends feedback data to Airtable using the Airtable.js SDK
 * Modify this function to match your Airtable schema
 */
async function sendToAirtable(
  feedback: FeedbackRecord,
  userInfo: { username: string | null; email: string | null } | null
): Promise<void> {
  if (!airtableBase) {
    console.warn('[feedback-to-airtable] Airtable not configured - skipping');
    return;
  }

  const { username, email } = userInfo ?? { username: null, email: null };

  // Map feedback fields to Airtable columns
  const airtableFields: Record<string, unknown> = {
    // Match your Airtable column names exactly
    Date: feedback.created_at,
    Title: feedback.title,
    Description: feedback.description,
    'Request Type': formatRequestType(feedback.request_type),

    email: email,
    'Organization Name': feedback.organization_name,
    'Your Name': username || 'Anonymous',
    'App Version': feedback.app_version
  };

  const validFields = Object.fromEntries(
    Object.entries(airtableFields).filter(([_, value]) => Boolean(value))
  );

  await logAirtableTableFields(validFields);

  try {
    // typecast lets Airtable coerce values (e.g. strings → single-select options)
    const record = await airtableBase(AIRTABLE_TABLE_NAME).create(validFields, {
      typecast: true
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
    // Simple secret verification - check X-Webhook-Secret header if configured
    if (FUNCTION_SECRET) {
      const providedSecret = req.headers.get('X-Function-Secret');
      if (providedSecret !== FUNCTION_SECRET) {
        console.error(
          '[feedback-to-airtable] Invalid or missing X-Webhook-Secret header'
        );
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const body = (await req.json()) as WebhookPayload;

    // Only process INSERT events
    if (body.type !== 'INSERT' || body.table !== 'feedback') {
      console.log(
        '[feedback-to-airtable] Ignoring event:',
        body.type,
        body.table
      );
      return new Response('Ignored', { status: 200 });
    }

    // Fetch user info from profile (not stored in feedback table)
    const userInfo = await getUserInfoFromProfile(body.record.profile_id);

    // Send to Airtable
    await sendToAirtable(body.record, userInfo);

    return new Response(
      JSON.stringify({ success: true, message: 'Feedback sent to Airtable' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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
 * Setup instructions:
 *
 * 1. Deploy this function:
 *    supabase functions deploy feedback-to-airtable
 *
 * 2. Set environment variables in Supabase Dashboard:
 *    - AIRTABLE_API_KEY: Your Airtable Personal Access Token (needs data.records:write and schema.bases:read for field debug logs)
 *    - AIRTABLE_BASE_ID: Your Airtable base ID (starts with 'app')
 *    - AIRTABLE_TABLE_NAME: Name of the table (e.g., 'Feedback')
 *    - FEEDBACK_FUNCTION_SECRET: Random secret for webhook verification
 *
 * 3. Set up Database Webhook in Supabase:
 *    - Go to Dashboard > Database > Webhooks
 *    - Create a new webhook on the 'feedback' table
 *    - Event: INSERT
 *    - URL: https://<project-ref>.supabase.co/functions/v1/feedback-to-airtable
 *    - Headers: Include the webhook secret if configured
 *
 * 4. Columns that MUST exist in your Airtable table (you already have most of these):
 *    - Date (Date field)
 *    - Title (Single line text)
 *    - Description (Long text)
 *    - Request Type (Single select with: 🐞 Bug, ✨ Feature, 💬 General, 📝 Other)
 *
 * 5. Columns you may need to ADD (optional, but recommended):
 *    - Your Name (Single line text) - username from profile
 *    - email (lowercase) - email from profile
 *    - Organization Name (Single line text) - optional, from feedback form
 *    - App Version (Single line text) - helps track issues
 *
 *    If you don't want to add these columns, remove them from the airtableFields object.
 */
