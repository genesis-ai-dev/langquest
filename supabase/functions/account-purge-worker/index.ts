import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { deleteFeedbackFromAirtable } from './airtable.ts';
import { purgePostHogUser } from './posthog.ts';

const dbUrl =
  Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('PS_DATA_SOURCE_URI');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!dbUrl) {
  throw new Error('Missing SUPABASE_DB_URL or PS_DATA_SOURCE_URI');
}
if (!serviceRoleKey) {
  throw new Error('Missing SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY');
}

const { Pool } = pg as unknown as {
  Pool: new (opts: { connectionString: string; max?: number }) => {
    connect: () => Promise<{
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
      release: () => void;
    }>;
  };
};

const pool = new Pool({ connectionString: dbUrl, max: 1 });
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

interface DueProfile {
  profile_id: string;
  email: string | null;
  deletion_requested_at: string;
  deletion_scheduled_for: string;
}

interface PurgeStepResult {
  profileId: string;
  status: 'purged' | 'failed';
  error?: string;
  posthog?: Awaited<ReturnType<typeof purgePostHogUser>>;
  airtableDeleted?: number;
}

function resolveLimit(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 10;
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 50);
}

async function hashEmail(email: string): Promise<string> {
  const secret = Deno.env.get('ERASURE_EMAIL_HASH_SECRET');
  if (!secret) {
    throw new Error('ERASURE_EMAIL_HASH_SECRET is not configured');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const normalized = email.trim().toLowerCase();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(normalized)
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function claimDueProfiles(limit: number): Promise<DueProfile[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'select * from public.claim_profiles_for_purge($1)',
      [limit]
    );
    return result.rows as DueProfile[];
  } finally {
    client.release();
  }
}

async function purgeUserIdentityData(profileId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'select public.purge_user_identity_data($1::uuid) as payload',
      [profileId]
    );
    return result.rows[0]?.payload as {
      consent_snapshot: Record<string, unknown>;
      feedback_deleted: number;
    };
  } finally {
    client.release();
  }
}

async function insertErasureRecord(params: {
  authUserId: string;
  emailHash: string;
  consentSnapshot: Record<string, unknown>;
}) {
  const { error } = await supabase.from('account_erasure').insert({
    auth_user_id: params.authUserId,
    email_hash: params.emailHash,
    consent_snapshot: params.consentSnapshot,
    erasure_source: 'scheduled_purge',
    erased_at: new Date().toISOString()
  });

  if (error) {
    throw error;
  }
}

async function deleteAuthUser(profileId: string) {
  const { error } = await supabase.auth.admin.deleteUser(profileId);
  if (error) {
    throw error;
  }

  const { error: profileError } = await supabase
    .from('profile')
    .delete()
    .eq('id', profileId);

  if (profileError) {
    console.warn(
      `[account-purge-worker] Profile row still present after auth delete for ${profileId}:`,
      profileError.message
    );
  }
}

async function hasErasureRecord(profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('account_erasure')
    .select('auth_user_id')
    .eq('auth_user_id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data != null;
}

async function purgeOneProfile(profile: DueProfile): Promise<PurgeStepResult> {
  try {
    const alreadyRecorded = await hasErasureRecord(profile.profile_id);
    let posthogResult: Awaited<ReturnType<typeof purgePostHogUser>> | undefined;
    let airtableDeleted = 0;

    if (!alreadyRecorded) {
      const identityResult = await purgeUserIdentityData(profile.profile_id);
      const airtableResult = await deleteFeedbackFromAirtable(profile.email);
      airtableDeleted = airtableResult.deleted;
      posthogResult = await purgePostHogUser(profile.profile_id);

      await insertErasureRecord({
        authUserId: profile.profile_id,
        emailHash: await hashEmail(profile.email ?? ''),
        consentSnapshot: identityResult?.consent_snapshot ?? {}
      });
    }

    await deleteAuthUser(profile.profile_id);

    return {
      profileId: profile.profile_id,
      status: 'purged',
      posthog: posthogResult,
      airtableDeleted
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[account-purge-worker] Failed to purge profile ${profile.profile_id}:`,
      message
    );
    return {
      profileId: profile.profile_id,
      status: 'failed',
      error: message
    };
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    });
  }

  const expectedSecret = Deno.env.get('ACCOUNT_PURGE_CRON_SECRET');
  if (expectedSecret) {
    const provided = req.headers.get('x-cron-secret');
    if (provided !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  try {
    const url = new URL(req.url);
    const limit = resolveLimit(url.searchParams.get('limit'));
    const dueProfiles = await claimDueProfiles(limit);

    const results: PurgeStepResult[] = [];
    for (const profile of dueProfiles) {
      results.push(await purgeOneProfile(profile));
    }

    const purged = results.filter(
      (result) => result.status === 'purged'
    ).length;
    const failed = results.filter(
      (result) => result.status === 'failed'
    ).length;

    return new Response(
      JSON.stringify({
        ok: true,
        claimed: dueProfiles.length,
        purged,
        failed,
        results
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[account-purge-worker]', message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
