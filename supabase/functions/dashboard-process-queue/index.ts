import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import pg from 'npm:pg@8.11.3';
import { processQueue, resolveLimit, type QueueRow } from './core.ts';
import type {
  JsonRecord,
  ProjectDashboardContext,
  ProjectDashboardPayload
} from './types.ts';

const dbUrl =
  Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('PS_DATA_SOURCE_URI');

if (!dbUrl) {
  throw new Error(
    'Missing database connection string. Set SUPABASE_DB_URL or PS_DATA_SOURCE_URI.'
  );
}

const { Pool } = pg as unknown as {
  Pool: new (opts: { connectionString: string; max?: number }) => any;
};
const pool = new Pool({ connectionString: dbUrl, max: 1 });

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function claimQueueRows(client: any, limit: number): Promise<QueueRow[]> {
  const sql = `
    update public.dashboard_refresh_queue q
    set
      status = 'processing',
      processing_at = now()
    where q.id in (
      select id
      from public.dashboard_refresh_queue
      where
        status = 'pending'
        or (status = 'failed' and next_attempt_at < now())
      order by created_at
      limit $1
      for update skip locked
    )
    returning id, project_id, status, retry_count;
  `;

  const result = await client.query(sql, [limit]);
  return result.rows as QueueRow[];
}

async function fetchTableRows(
  client: any,
  tableName: string,
  projectId: string,
  projectColumn = 'project_id'
): Promise<JsonRecord[]> {
  const sql = `select to_jsonb(t) as row from public.${tableName} t where t.${projectColumn} = $1`;
  const result = await client.query(sql, [projectId]);
  return result.rows.map((row: { row: JsonRecord }) => row.row);
}

async function fetchProjectContext(
  client: any,
  projectId: string
): Promise<ProjectDashboardContext | null> {
  const projectResult = await client.query(
    'select to_jsonb(p) as row from public.project p where p.id = $1 limit 1',
    [projectId]
  );

  if (projectResult.rowCount === 0) {
    return null;
  }

  const project = projectResult.rows[0].row as JsonRecord;
  const quests = await fetchTableRows(client, 'quest', projectId, 'project_id');
  const questIds = quests
    .map((quest) => asString(quest.id))
    .filter((id): id is string => id !== null);

  let questAssetLinks: JsonRecord[] = [];
  if (questIds.length > 0) {
    const qalResult = await client.query(
      `
        select to_jsonb(qal) as row
        from public.quest_asset_link qal
        where qal.quest_id = any($1::uuid[])
      `,
      [questIds]
    );
    questAssetLinks = qalResult.rows.map((row: { row: JsonRecord }) => row.row);
  }

  const linkedAssetIds = questAssetLinks
    .map((link) => asString(link.asset_id))
    .filter((id): id is string => id !== null);

  const assetsResult = await client.query(
    `
      select to_jsonb(a) as row
      from public.asset a
      where a.project_id = $1
         or (
           $2::uuid[] is not null
           and cardinality($2::uuid[]) > 0
           and a.id = any($2::uuid[])
         )
    `,
    [projectId, linkedAssetIds]
  );
  const assets = assetsResult.rows.map((row: { row: JsonRecord }) => row.row);
  const profileProjectLinks = await fetchTableRows(
    client,
    'profile_project_link',
    projectId,
    'project_id'
  );
  const projectLanguageLinks = await fetchTableRows(
    client,
    'project_language_link',
    projectId,
    'project_id'
  );

  const assetIds = assets
    .map((asset) => asString(asset.id))
    .filter((id): id is string => id !== null);

  let assetContentLinks: JsonRecord[] = [];
  if (assetIds.length > 0) {
    const aclResult = await client.query(
      `
        select to_jsonb(acl) as row
        from public.asset_content_link acl
        where acl.asset_id = any($1::uuid[])
      `,
      [assetIds]
    );
    assetContentLinks = aclResult.rows.map(
      (row: { row: JsonRecord }) => row.row
    );
  }

  const projectTemplate = asString(project.template);
  let templateStructureRows: JsonRecord[] = [];
  if (projectTemplate) {
    const templateStructureResult = await client.query(
      `
        select to_jsonb(ts) as row
        from public.template_structure ts
        where
          ts.template = $1
          and ts.language = 'any'
          and ts.item_id is not null
      `,
      [projectTemplate]
    );
    templateStructureRows = templateStructureResult.rows.map(
      (row: { row: JsonRecord }) => row.row
    );
  }

  return {
    project,
    quests,
    assets,
    assetContentLinks,
    questAssetLinks,
    profileProjectLinks,
    projectLanguageLinks,
    templateStructureRows
  };
}

async function upsertDashboard(
  client: any,
  payload: ProjectDashboardPayload
): Promise<void> {
  const sql = `
    insert into public.project_dashboard_current (
      project_id,
      project_status,
      total_quests,
      total_subquests,
      expected_quests,
      total_assets,
      total_quests_versions,
      completed_quests,
      completed_subquests,
      inactive_quests,
      inactive_assets,
      assets_with_text,
      assets_with_audio,
      assets_with_image,
      assets_with_transcription,
      assets_with_translation,
      total_source_languages,
      total_target_languages,
      total_members,
      total_owners,
      dashboard_json
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb
    )
    on conflict (project_id)
    do update set
      project_status = excluded.project_status,
      total_quests = excluded.total_quests,
      total_subquests = excluded.total_subquests,
      expected_quests = excluded.expected_quests,
      total_assets = excluded.total_assets,
      total_quests_versions = excluded.total_quests_versions,
      completed_quests = excluded.completed_quests,
      completed_subquests = excluded.completed_subquests,
      inactive_quests = excluded.inactive_quests,
      inactive_assets = excluded.inactive_assets,
      assets_with_text = excluded.assets_with_text,
      assets_with_audio = excluded.assets_with_audio,
      assets_with_image = excluded.assets_with_image,
      assets_with_transcription = excluded.assets_with_transcription,
      assets_with_translation = excluded.assets_with_translation,
      total_source_languages = excluded.total_source_languages,
      total_target_languages = excluded.total_target_languages,
      total_members = excluded.total_members,
      total_owners = excluded.total_owners,
      dashboard_json = excluded.dashboard_json,
      updated_at = now();
  `;

  await client.query(sql, [
    payload.project_id,
    payload.project_status,
    payload.total_quests,
    payload.total_subquests,
    payload.expected_quests,
    payload.total_assets,
    payload.total_quests_versions,
    payload.completed_quests,
    payload.completed_subquests,
    payload.inactive_quests,
    payload.inactive_assets,
    payload.assets_with_text,
    payload.assets_with_audio,
    payload.assets_with_image,
    payload.assets_with_transcription,
    payload.assets_with_translation,
    payload.total_source_languages,
    payload.total_target_languages,
    payload.total_members,
    payload.total_owners,
    JSON.stringify(payload.dashboard_json)
  ]);
}

async function markQueueSuccess(client: any, queueId: string): Promise<void> {
  await client.query(
    'delete from public.dashboard_refresh_queue where id = $1',
    [queueId]
  );
}

async function markQueueFailure(
  client: any,
  queueId: string,
  currentRetryCount: number,
  errorMessage: string
): Promise<void> {
  const nextRetryCount = currentRetryCount + 1;
  const sql = `
    update public.dashboard_refresh_queue
    set
      status = 'failed',
      retry_count = $2,
      last_error = $3,
      processing_at = null,
      next_attempt_at = now() + ($2::int * interval '10 minute')
    where id = $1
  `;
  await client.query(sql, [queueId, nextRetryCount, errorMessage]);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const expectedSecret = Deno.env.get('DASHBOARD_QUEUE_CRON_SECRET');
    if (expectedSecret) {
      const provided = req.headers.get('x-cron-secret');
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }
    }

    const url = new URL(req.url);
    const limit = resolveLimit(url.searchParams.get('limit'));
    const result = await withClient((client) =>
      processQueue({
        limit,
        claimQueueRows: (batchLimit: number) =>
          claimQueueRows(client, batchLimit),
        fetchProjectContext: (projectId: string) =>
          fetchProjectContext(client, projectId),
        upsertDashboard: (payload: ProjectDashboardPayload) =>
          upsertDashboard(client, payload),
        markQueueSuccess: (queueId: string) =>
          markQueueSuccess(client, queueId),
        markQueueFailure: (
          queueId: string,
          currentRetryCount: number,
          errorMessage: string
        ) => markQueueFailure(client, queueId, currentRetryCount, errorMessage)
      })
    );

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
});
