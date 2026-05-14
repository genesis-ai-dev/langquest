import { createClient } from 'npm:@supabase/supabase-js@2';
import { crypto } from 'jsr:@std/crypto';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY');
const resendWebhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/**
 * Verify Resend webhook signature
 * Resend signs webhooks using the webhook secret
 */
async function verifySignature(payload: string, signature: string | null): Promise<boolean> {
  if (!resendWebhookSecret || !signature) {
    console.warn('Missing webhook secret or signature');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(resendWebhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const signatureBytes = hexToBytes(signature);
    const payloadBytes = encoder.encode(payload);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      payloadBytes
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    id: string;
    object: string;
    to: string[];
    from: string;
    created_at: string;
    subject: string;
    bounce?: {
      type: 'hard_bounce' | 'soft_bounce' | 'block';
      message: string;
      code?: number;
    };
  };
}

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get('resend-signature');

    // Verify signature in production
    if (resendWebhookSecret) {
      const isValid = await verifySignature(payload, signature);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const event: ResendWebhookPayload = JSON.parse(payload);
    const { type, data } = event;
    const emailId = data.id;

    console.log(`[Resend Webhook] Received ${type} for email ${emailId}`);

    // Find invite by resend_email_id
    const { data: invite, error: findError } = await supabase
      .from('invite')
      .select('id, email_status')
      .eq('resend_email_id', emailId)
      .single();

    if (findError || !invite) {
      // Email might not be an invite (could be auth email), just acknowledge
      console.log(`[Resend Webhook] No invite found for email ${emailId}, acknowledging`);
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

    console.log(`[Resend Webhook] Updated invite ${invite.id} with status ${updateData.email_status}`);

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
