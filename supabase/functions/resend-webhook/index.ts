import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY');
const resendWebhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing required environment variables: SUPABASE_URL or SERVICE_ROLE_KEY'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    created_at: string;
    subject: string;
    bounce?: {
      type: string;
      message: string;
      diagnosticCode?: string[];
      subType?: string;
    };
  };
}

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await req.text();

    let event: ResendWebhookPayload;

    // https://resend.com/docs/webhooks/verify-webhooks-requests — raw body + Svix headers
    if (resendWebhookSecret) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        console.error(
          '[Resend Webhook] RESEND_API_KEY is required when RESEND_WEBHOOK_SECRET is set'
        );
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const id = req.headers.get('svix-id');
      const timestamp = req.headers.get('svix-timestamp');
      const signature = req.headers.get('svix-signature');
      if (!id || !timestamp || !signature) {
        return new Response(
          JSON.stringify({ error: 'Missing Svix webhook headers' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      try {
        const resend = new Resend(resendApiKey);
        event = resend.webhooks.verify({
          payload,
          headers: { id, timestamp, signature },
          webhookSecret: resendWebhookSecret
        }) as unknown as ResendWebhookPayload;
      } catch (error) {
        console.error('[Resend Webhook] SDK verification failed:', error);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      event = JSON.parse(payload) as ResendWebhookPayload;
    }
    const { type, data } = event;
    const emailId = data.email_id;

    console.log(`[Resend Webhook] Received ${type} for email ${emailId}`);

    // Find invite by resend_email_id
    const { data: invite, error: findError } = await supabase
      .from('invite')
      .select('id, email_status')
      .eq('resend_email_id', emailId)
      .single();

    if (findError || !invite) {
      // Email might not be an invite (could be auth email), just acknowledge
      console.log(
        `[Resend Webhook] No invite found for email ${emailId}, acknowledging`
      );
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare update based on event type
    let updateData: Record<string, unknown> = {};
    const now = new Date().toISOString();

    switch (type) {
      case 'email.sent':
        // Already set when we sent, but confirm it
        updateData = { email_status: 'sent', email_sent_at: now };
        break;

      case 'email.delivered':
        updateData = { email_status: 'delivered', email_delivered_at: now };
        break;

      case 'email.bounced':
        updateData = {
          email_status: 'bounced',
          email_bounced_at: now,
          bounce_reason: data.bounce
            ? `${data.bounce.type}: ${data.bounce.message}`
            : 'Unknown bounce reason'
        };
        break;

      case 'email.complained':
        updateData = { email_status: 'complained' };
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event type: ${type}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    // Update the invite
    const { error: updateError } = await supabase
      .from('invite')
      .update(updateData)
      .eq('id', invite.id);

    if (updateError) {
      console.error('[Resend Webhook] Failed to update invite:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update invite' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[Resend Webhook] Updated invite ${invite.id} with status ${updateData.email_status}`
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Resend Webhook] Error processing webhook:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
