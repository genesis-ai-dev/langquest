import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function resolveMinutes(input: unknown): number {
  if (input === undefined || input === null || input === "") return 10;

  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    throw new Error("minutes must be a valid number");
  }

  const asInt = Math.floor(parsed);
  if (asInt < 0) {
    throw new Error("minutes must be >= 0");
  }

  return asInt === 0 ? 10 : asInt;
}

function chunk<T>(arr: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function throwIfError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function enqueueDashboardRefresh(minutes: number) {
  const cutoffIso = new Date(Date.now() - minutes * 60_000).toISOString();
  const projectIds = new Set<string>();

  const addProjectIds = (rows: Array<{ [key: string]: unknown }> | null, field = "project_id") => {
    for (const row of rows || []) {
      const value = row[field];
      if (typeof value === "string" && value.length > 0) {
        projectIds.add(value);
      }
    }
  };

  const mapAssetsToProjects = async (assetIds: string[]) => {
    if (!assetIds.length) return;

    const questIds = new Set<string>();
    for (const ids of chunk(assetIds)) {
      const { data, error } = await supabase
        .from("quest_asset_link")
        .select("quest_id")
        .in("asset_id", ids);
      throwIfError(error, "Failed querying quest_asset_link");

      for (const row of data || []) {
        if (row.quest_id) questIds.add(row.quest_id);
      }
    }

    if (!questIds.size) return;

    for (const ids of chunk(Array.from(questIds))) {
      const { data, error } = await supabase
        .from("quest")
        .select("project_id")
        .in("id", ids);
      throwIfError(error, "Failed querying quest for project_id");
      addProjectIds(data, "project_id");
    }
  };

  {
    const { data, error } = await supabase
      .from("project")
      .select("id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying project");
    addProjectIds(data, "id");
  }

  {
    const { data, error } = await supabase
      .from("quest")
      .select("project_id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying quest");
    addProjectIds(data, "project_id");
  }

  {
    const { data, error } = await supabase
      .from("asset")
      .select("id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying asset");
    await mapAssetsToProjects((data || []).map((row) => row.id).filter((id): id is string => Boolean(id)));
  }

  {
    const { data, error } = await supabase
      .from("asset_content_link")
      .select("asset_id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying asset_content_link");
    await mapAssetsToProjects(
      (data || [])
        .map((row) => row.asset_id)
        .filter((assetId): assetId is string => Boolean(assetId)),
    );
  }

  {
    const { data, error } = await supabase
      .from("quest_asset_link")
      .select("quest_id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying quest_asset_link");

    const questIds = Array.from(
      new Set((data || []).map((row) => row.quest_id).filter((id): id is string => Boolean(id))),
    );

    for (const ids of chunk(questIds)) {
      const { data: questRows, error: questError } = await supabase
        .from("quest")
        .select("project_id")
        .in("id", ids);
      throwIfError(questError, "Failed querying quest from quest_asset_link");
      addProjectIds(questRows, "project_id");
    }
  }

  {
    const { data, error } = await supabase
      .from("profile_project_link")
      .select("project_id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying profile_project_link");
    addProjectIds(data, "project_id");
  }

  {
    const { data, error } = await supabase
      .from("project_language_link")
      .select("project_id")
      .gt("last_updated", cutoffIso);
    throwIfError(error, "Failed querying project_language_link");
    addProjectIds(data, "project_id");
  }

  const candidateIds = Array.from(projectIds);
  if (!candidateIds.length) {
    return {
      projects_in_window: 0,
      inserted_count: 0,
      inserted_project_ids: [] as string[],
    };
  }

  const nowIso = new Date().toISOString();
  const payload = candidateIds.map((projectId) => ({
    project_id: projectId,
    status: "pending",
    next_attempt_at: nowIso,
  }));

  const { data: insertedRows, error: insertError } = await supabase
    .from("dashboard_refresh_queue")
    .upsert(payload, { onConflict: "project_id", ignoreDuplicates: true })
    .select("project_id");

  throwIfError(insertError, "Failed inserting queue items");

  return {
    projects_in_window: candidateIds.length,
    inserted_count: (insertedRows || []).length,
    inserted_project_ids: (insertedRows || []).map((row) => row.project_id),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("DASHBOARD_QUEUE_CRON_SECRET");
    if (expectedSecret) {
      const providedSecret = req.headers.get("x-cron-secret");
      if (providedSecret !== expectedSecret) {
        return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const rawMinutes =
      url.searchParams.get("minutes") ??
      ((body && typeof body === "object" && "minutes" in body)
        ? (body as { minutes?: unknown }).minutes
        : undefined);

    const minutes = resolveMinutes(rawMinutes);
    const result = await enqueueDashboardRefresh(minutes);

    return jsonResponse({
      ok: true,
      minutes_used: minutes,
      projects_in_window: result.projects_in_window,
      inserted_count: result.inserted_count,
      inserted_project_ids: result.inserted_project_ids,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
