import { system } from '@/db/powersync/system';
import { Platform } from 'react-native';

export type PublishErrorStage = 'move_file' | 'save_record' | 'upload_file';

export interface ReportPublishErrorParams {
  stage: PublishErrorStage;
  errorCode?: string | null;
  refCode?: string | null;
  message: string;
  questId?: string | null;
  projectId?: string | null;
  assetId?: string | null;
  attachmentId?: string | null;
  uri?: string | null;
  platformOS?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persists publish/attachment failures to public.upload_inbox.
 * Keeps the same output fields used by the transactional RPC inbox.
 */
export async function reportPublishErrorToUploadInbox(
  params: ReportPublishErrorParams
): Promise<{ success: true } | { success: false; error: string }> {
  const normalizedRefCode =
    params.refCode?.trim() ||
    Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
  const normalizedErrorCode = params.errorCode?.trim() || 'PUBLISH_ERROR';

  const data = {
    source: 'publish_quest',
    stage: params.stage,
    quest_id: params.questId ?? null,
    project_id: params.projectId ?? null,
    asset_id: params.assetId ?? null,
    attachment_id: params.attachmentId ?? null,
    uri: params.uri ?? null,
    platform_os: Platform.OS,
    occurred_at: new Date().toISOString()
  };

  const logs = `[publish_quest] stage=${params.stage} message=${params.message}`;

  try {
    const { error } = await system.supabaseConnector.client
      .from('upload_inbox')
      .insert({
        data,
        logs,
        error_code: normalizedErrorCode,
        ref_code: normalizedRefCode
      });

    if (error) {
      console.error('[reportPublishErrorToUploadInbox] Insert failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[reportPublishErrorToUploadInbox] Unexpected failure:', error);
    return { success: false, error: message };
  }
}
