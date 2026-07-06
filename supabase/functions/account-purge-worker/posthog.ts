const ALLOWED_REIMPORT_PROPS = new Set([
  'from_version',
  'to_version',
  'db_restored',
  'local_store_restored'
]);

export interface PostHogPurgeResult {
  mode: 'anonymized_keep' | 'simple_delete' | 'skipped';
  deleteTaskId?: string;
  reimportedEvents?: number;
  error?: string;
}

function getPostHogConfig() {
  const apiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID');
  const host = (Deno.env.get('POSTHOG_API_HOST') ?? 'https://us.posthog.com').replace(
    /\/$/,
    ''
  );
  const projectApiKey = Deno.env.get('POSTHOG_PROJECT_API_KEY');
  const ingestHost = (
    Deno.env.get('POSTHOG_INGEST_HOST') ?? 'https://us.i.posthog.com'
  ).replace(/\/$/, '');

  return { apiKey, projectId, host, projectApiKey, ingestHost };
}

async function hogqlExportEvents(
  host: string,
  apiKey: string,
  projectId: string,
  authUserId: string
): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: `SELECT event, timestamp, properties FROM events WHERE distinct_id = '${authUserId}'`
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PostHog HogQL export failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const results = payload?.results;
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((row: unknown[]) => ({
    event: row[0],
    timestamp: row[1],
    properties: row[2] ?? {}
  }));
}

function buildAnonymizedEvents(
  exported: Record<string, unknown>[],
  newDistinctId: string
) {
  const batch: Array<{
    event: string;
    properties: Record<string, unknown>;
    timestamp: string;
  }> = [];

  for (const row of exported) {
    const eventName = row.event;
    if (typeof eventName !== 'string' || eventName.startsWith('$')) {
      continue;
    }

    const properties: Record<string, unknown> = {
      distinct_id: newDistinctId,
      $geoip_disable: true
    };
    const sourceProps =
      row.properties && typeof row.properties === 'object'
        ? (row.properties as Record<string, unknown>)
        : {};

    for (const key of ALLOWED_REIMPORT_PROPS) {
      if (sourceProps[key] !== undefined) {
        properties[key] = sourceProps[key];
      }
    }

    const timestamp =
      typeof row.timestamp === 'string'
        ? row.timestamp
        : new Date().toISOString();

    batch.push({ event: eventName, properties, timestamp });
  }

  return batch;
}

async function reimportAnonymizedEvents(
  ingestHost: string,
  projectApiKey: string,
  batch: Array<{
    event: string;
    properties: Record<string, unknown>;
    timestamp: string;
  }>
) {
  if (batch.length === 0) {
    return;
  }

  const chunkSize = 100;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    const response = await fetch(`${ingestHost}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: projectApiKey,
        historical_migration: true,
        batch: chunk
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PostHog re-import failed: ${response.status} ${body}`);
    }
  }
}

async function bulkDeletePerson(
  host: string,
  apiKey: string,
  projectId: string,
  authUserId: string
): Promise<string | undefined> {
  const response = await fetch(
    `${host}/api/projects/${projectId}/persons/bulk_delete/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        distinct_ids: [authUserId],
        delete_events: true,
        delete_recordings: true
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PostHog bulk delete failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return typeof payload?.task === 'string' ? payload.task : undefined;
}

async function waitForDeleteStatus(
  host: string,
  apiKey: string,
  projectId: string,
  taskId: string
) {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `${host}/api/projects/${projectId}/persons/delete_status/?task=${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` }
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PostHog delete_status failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    if (payload?.status === 'complete') {
      return;
    }
    if (payload?.status === 'failed') {
      throw new Error('PostHog person delete task failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.warn('[account-purge-worker] PostHog delete_status still pending after wait');
}

export async function purgePostHogUser(
  authUserId: string
): Promise<PostHogPurgeResult> {
  const { apiKey, projectId, host, projectApiKey, ingestHost } =
    getPostHogConfig();

  if (!apiKey || !projectId) {
    console.warn('[account-purge-worker] PostHog API credentials missing; skipping');
    return { mode: 'skipped' };
  }

  const useAnonymizedKeep =
    Deno.env.get('POSTHOG_PURGE_MODE') !== 'simple_delete' && !!projectApiKey;

  try {
    let reimportedEvents = 0;

    if (useAnonymizedKeep) {
      const exported = await hogqlExportEvents(host, apiKey, projectId, authUserId);
      const newDistinctId = crypto.randomUUID();
      const anonymizedBatch = buildAnonymizedEvents(exported, newDistinctId);

      const deleteTaskId = await bulkDeletePerson(
        host,
        apiKey,
        projectId,
        authUserId
      );

      await reimportAnonymizedEvents(ingestHost, projectApiKey!, anonymizedBatch);
      reimportedEvents = anonymizedBatch.length;

      if (deleteTaskId) {
        await waitForDeleteStatus(host, apiKey, projectId, deleteTaskId);
      }

      return {
        mode: 'anonymized_keep',
        deleteTaskId,
        reimportedEvents
      };
    }

    const deleteTaskId = await bulkDeletePerson(
      host,
      apiKey,
      projectId,
      authUserId
    );
    if (deleteTaskId) {
      await waitForDeleteStatus(host, apiKey, projectId, deleteTaskId);
    }

    return { mode: 'simple_delete', deleteTaskId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[account-purge-worker] PostHog purge failed:', message);

    try {
      const deleteTaskId = await bulkDeletePerson(
        host,
        apiKey,
        projectId,
        authUserId
      );
      if (deleteTaskId) {
        await waitForDeleteStatus(host, apiKey, projectId, deleteTaskId);
      }
      return { mode: 'simple_delete', deleteTaskId, error: message };
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      return { mode: 'skipped', error: fallbackMessage };
    }
  }
}
