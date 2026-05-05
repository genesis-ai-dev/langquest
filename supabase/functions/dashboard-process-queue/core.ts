import { buildBibleDashboard } from './bible.ts';
import { buildFiaDashboard } from './fia.ts';
import type {
  ProjectDashboardContext,
  ProjectDashboardPayload,
  ProjectTemplate
} from './types.ts';
import { buildUnstructuredDashboard } from './unstructured.ts';

export type QueueRow = {
  id: string;
  project_id: string;
  status: 'pending' | 'processing' | 'failed';
  retry_count: number;
};

export type QueueProcessDetail = {
  queue_id: string;
  project_id: string;
  template?: ProjectTemplate;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
};

export type QueueProcessResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  details: QueueProcessDetail[];
};

type QueueProcessorDeps = {
  limit: number;
  claimQueueRows: (limit: number) => Promise<QueueRow[]>;
  fetchProjectContext: (projectId: string) => Promise<ProjectDashboardContext | null>;
  upsertDashboard: (payload: ProjectDashboardPayload) => Promise<void>;
  markQueueSuccess: (queueId: string) => Promise<void>;
  markQueueFailure: (
    queueId: string,
    currentRetryCount: number,
    errorMessage: string
  ) => Promise<void>;
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function resolveTemplate(value: unknown): ProjectTemplate {
  if (value === 'bible' || value === 'fia' || value === 'unstructured') {
    return value;
  }
  return 'unstructured';
}

export function resolveLimit(value: string | null): number {
  if (!value) return 20;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  const intValue = Math.floor(parsed);
  if (intValue <= 0) return 20;
  return Math.min(intValue, 100);
}

export function buildPayload(
  context: ProjectDashboardContext
): ProjectDashboardPayload {
  const projectId = asString(context.project.id);
  if (!projectId) {
    throw new Error('project id is missing');
  }

  const template = resolveTemplate(context.project.template);
  const projectStatus = asBoolean(context.project.active, false)
    ? 'active'
    : 'inactive';

  const metrics =
    template === 'bible'
      ? buildBibleDashboard(context)
      : template === 'fia'
        ? buildFiaDashboard(context)
        : buildUnstructuredDashboard(context);

  return {
    project_id: projectId,
    project_status: projectStatus,
    template,
    ...metrics
  };
}

export async function processQueue(
  deps: QueueProcessorDeps
): Promise<QueueProcessResult> {
  const queueRows = await deps.claimQueueRows(deps.limit);
  const details: QueueProcessDetail[] = [];

  let succeeded = 0;
  let failed = 0;

  for (const queueRow of queueRows) {
    try {
      const context = await deps.fetchProjectContext(queueRow.project_id);

      if (!context) {
        await deps.markQueueSuccess(queueRow.id);
        details.push({
          queue_id: queueRow.id,
          project_id: queueRow.project_id,
          status: 'skipped',
          message: 'project not found; queue row removed'
        });
        continue;
      }

      const payload = buildPayload(context);
      await deps.upsertDashboard(payload);
      await deps.markQueueSuccess(queueRow.id);

      succeeded += 1;
      details.push({
        queue_id: queueRow.id,
        project_id: queueRow.project_id,
        template: payload.template,
        status: 'success'
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await deps.markQueueFailure(queueRow.id, queueRow.retry_count, message);
      details.push({
        queue_id: queueRow.id,
        project_id: queueRow.project_id,
        status: 'failed',
        message
      });
    }
  }

  return {
    claimed: queueRows.length,
    succeeded,
    failed,
    details
  };
}
