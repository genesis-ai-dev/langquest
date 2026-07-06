import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const DELETION_GRACE_DAYS = 30;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;
const transactionalEmailSecret = Deno.env.get('TRANSACTIONAL_EMAIL_SECRET');

function mapLanguoidNameToLocale(
  languoidName: string | null | undefined
): string {
  if (!languoidName) return 'en';

  const normalized = languoidName.toLowerCase().trim();
  const mapping: Record<string, string> = {
    english: 'en',
    spanish: 'es',
    french: 'fr',
    'brazilian portuguese': 'pt-BR',
    'tok pisin': 'tpi-PG',
    'standard indonesian': 'id-ID',
    indonesian: 'id-ID',
    nepali: 'ne',
    hindi: 'hi',
    burmese: 'my',
    myanmar: 'my',
    thai: 'th',
    mandarin: 'zh-CN',
    'mandarin chinese': 'zh-CN',
    chinese: 'zh-CN'
  };

  return mapping[normalized] ?? 'en';
}

function formatPurgeDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

async function sendDeletionScheduledEmail(params: {
  email: string;
  purgeDate: string;
  locale: string;
}) {
  if (!transactionalEmailSecret) {
    throw new Error('TRANSACTIONAL_EMAIL_SECRET is not configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-transactional-email-secret': transactionalEmailSecret
    },
    body: JSON.stringify({
      type: 'deletion_scheduled',
      email: params.email,
      purge_date: params.purgeDate,
      locale: params.locale
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send deletion email: ${response.status} ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await admin
      .from('profile')
      .select(
        'id, email, active, deletion_requested_at, deletion_scheduled_for, ui_language_id, ui_languoid_id'
      )
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (profile.deletion_requested_at) {
      return new Response(
        JSON.stringify({
          error: 'deletion_already_scheduled',
          deletion_scheduled_for: profile.deletion_scheduled_for
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const requestedAt = new Date();
    const scheduledFor = new Date(requestedAt);
    scheduledFor.setUTCDate(
      scheduledFor.getUTCDate() + DELETION_GRACE_DAYS
    );

    const { error: updateError } = await admin
      .from('profile')
      .update({
        active: false,
        deletion_requested_at: requestedAt.toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    let locale = 'en';
    if (profile.ui_languoid_id) {
      const { data: languoid } = await admin
        .from('languoid')
        .select('name')
        .eq('id', profile.ui_languoid_id)
        .single();
      locale = mapLanguoidNameToLocale(languoid?.name);
    } else if (profile.ui_language_id) {
      const { data: language } = await admin
        .from('language')
        .select('locale')
        .eq('id', profile.ui_language_id)
        .single();
      locale = language?.locale ?? 'en';
    }

    const email = profile.email ?? user.email;
    if (email) {
      await sendDeletionScheduledEmail({
        email,
        purgeDate: formatPurgeDate(scheduledFor.toISOString()),
        locale
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        deletion_requested_at: requestedAt.toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[request-account-deletion]', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
