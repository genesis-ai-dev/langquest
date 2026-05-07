/* Enqueue a single project for dashboard refresh */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function resolveProjectId(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('project_id is required');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('project_id is required');
  }

  return trimmed;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const expectedSecret = Deno.env.get('DASHBOARD_QUEUE_CRON_SECRET');
    if (expectedSecret) {
      const providedSecret = req.headers.get('x-cron-secret');
      if (providedSecret !== expectedSecret) {
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
      }
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const rawProjectId =
      url.searchParams.get('project_id') ??
      (body && typeof body === 'object' && 'project_id' in body
        ? (body as { project_id?: unknown }).project_id
        : undefined);

    const projectId = resolveProjectId(rawProjectId);
    const nowIso = new Date().toISOString();

    const { data: insertedRows, error: insertError } = await supabase
      .from('dashboard_refresh_queue')
      .upsert(
        [
          {
            project_id: projectId,
            status: 'pending',
            next_attempt_at: nowIso
          }
        ],
        { onConflict: 'project_id', ignoreDuplicates: true }
      )
      .select('project_id');

    if (insertError) {
      throw new Error(`Failed inserting queue item: ${insertError.message}`);
    }

    const inserted = (insertedRows || []).length > 0;

    return jsonResponse({
      ok: true,
      project_id: projectId,
      inserted
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});
