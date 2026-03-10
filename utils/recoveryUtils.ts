import { reportPublishErrorToUploadInbox } from '@/database_services/errorReporterService';
import { system } from '@/db/powersync/system';
import { AppConfig } from '@/db/supabase/AppConfig';
import {
  copyFile,
  deleteIfExists,
  ensureDir,
  fileExists,
  getDirectory,
  getFileInfo,
  getLocalAttachmentUri,
  getLocalAttachmentUriWithOPFS
} from '@/utils/fileUtils';
import { AttachmentState } from '@powersync/attachments';
import { eq, inArray } from 'drizzle-orm';
import { resolveTable } from './dbUtils';

type RecoveryStepStatus = 'started' | 'completed' | 'error';

export interface RecoveryStepUpdate {
  step:
    | 'validate_quest'
    | 'scan_expected_audio'
    | 'copy_missing_to_sync'
    | 'check_cloud'
    | 'queue_and_upload'
    | 'delete_originals'
    | 'finish';
  status: RecoveryStepStatus;
  message: string;
  data?: Record<string, unknown>;
}

export interface RecoverQuestAudioOptions {
  onStep?: (update: RecoveryStepUpdate) => void;
  deleteRecoveredOriginals?: boolean;
}

export interface RecoverQuestAudioReport {
  success: boolean;
  questId: string;
  profileId: string;
  steps: RecoveryStepUpdate[];
  errors: string[];
  pendingAudioIds: string[];
  uploadedAudioIds: string[];
  totalExpectedFiles: number;
  totalUnsyncedRecords: number;
  totalNotFoundOnDevice: number;
  totalCopyErrors: number;
  totalCopiedSuccessfully: number;
  totalNotFoundOnServer: number;
  totalUploadSyncErrors: number;
  totalDeleteErrors: number;
  totalDeleted: number;
}

interface ExpectedAudioEntry {
  assetId: string;
  contentLinkId: string;
  audioRawValue: string;
  audioId: string;
  syncUri: string;
}

function normalizeAudioId(audioValue: string): string | null {
  if (!audioValue) return null;

  if (audioValue.startsWith('local/')) {
    return audioValue.replace(/^local\//, '');
  }

  if (audioValue.startsWith('file://')) {
    const tail = audioValue.split('/').pop();
    if (!tail) return null;
    const normalized = tail.split('?')[0];
    return normalized || null;
  }

  return audioValue;
}

function toAudioArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === 'string' && !!item
  );
}

async function cloudObjectExists(filename: string): Promise<boolean> {
  if (!AppConfig.supabaseBucket) {
    return false;
  }

  const { data, error } = await system.supabaseConnector.client.storage
    .from(AppConfig.supabaseBucket)
    .list('', {
      limit: 20,
      search: filename
    });

  if (error) {
    throw new Error(`Cloud list failed for "${filename}": ${error.message}`);
  }

  return data.some((item) => item.name === filename);
}

async function tryResolveOriginalAudioUri(
  audioRawValue: string,
  targetAudioId: string,
  assetId: string,
  localAudioByAssetId: Map<string, string[]>
): Promise<string | null> {
  const directCandidates: string[] = [audioRawValue];
  const fallbackCandidates = localAudioByAssetId.get(assetId) ?? [];
  const candidates = [...directCandidates, ...fallbackCandidates];
  const seenCandidates = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (seenCandidates.has(candidate)) continue;
    seenCandidates.add(candidate);

    // SAFETY: never allow cross-file recovery.
    // Only candidates that normalize to the exact target audio ID are accepted.
    const candidateAudioId = normalizeAudioId(candidate);
    if (!candidateAudioId || candidateAudioId !== targetAudioId) {
      continue;
    }

    if (candidate.startsWith('local/')) {
      const localUri = await getLocalAttachmentUriWithOPFS(candidate);
      if (await fileExists(localUri)) {
        return localUri;
      }
      continue;
    }

    if (candidate.startsWith('file://')) {
      if (await fileExists(candidate)) {
        return candidate;
      }
      continue;
    }

    if (system.permAttachmentQueue) {
      const attachment = await system.powersync.getOptional<{
        id: string;
        local_uri: string | null;
      }>(`SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`, [
        targetAudioId
      ]);

      if (attachment?.local_uri) {
        const localUri = system.permAttachmentQueue.getLocalUri(
          attachment.local_uri
        );
        if (await fileExists(localUri)) {
          return localUri;
        }
      }
    }
  }

  return null;
}

export async function recoverPublishedQuestAudio(
  questId: string,
  profileId: string,
  options?: RecoverQuestAudioOptions
): Promise<RecoverQuestAudioReport> {
  const steps: RecoveryStepUpdate[] = [];
  const errors: string[] = [];
  const pendingAudioIds: string[] = [];
  const uploadedAudioIds: string[] = [];

  const copiedEntries: {
    audioId: string;
    sourceUri: string;
    syncUri: string;
  }[] = [];
  const syncMissingEntries: ExpectedAudioEntry[] = [];
  const notFoundServerIds = new Set<string>();

  const report: RecoverQuestAudioReport = {
    success: false,
    questId,
    profileId,
    steps,
    errors,
    pendingAudioIds,
    uploadedAudioIds,
    totalExpectedFiles: 0,
    totalUnsyncedRecords: 0,
    totalNotFoundOnDevice: 0,
    totalCopyErrors: 0,
    totalCopiedSuccessfully: 0,
    totalNotFoundOnServer: 0,
    totalUploadSyncErrors: 0,
    totalDeleteErrors: 0,
    totalDeleted: 0
  };

  const emitStep = (update: RecoveryStepUpdate) => {
    steps.push(update);
    options?.onStep?.(update);
  };

  const reportRecoveryIssue = async (params: {
    stage: 'move_file' | 'save_record' | 'upload_file';
    errorCode: string;
    message: string;
    attachmentId?: string | null;
    uri?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    const result = await reportPublishErrorToUploadInbox({
      stage: params.stage,
      errorCode: params.errorCode,
      message: params.message,
      questId,
      attachmentId: params.attachmentId ?? null,
      uri: params.uri ?? null,
      metadata: {
        profileId,
        recovery: true,
        ...(params.metadata ?? {})
      }
    });

    if (__DEV__) {
      console.log('[recoverPublishedQuestAudio][dev] upload_inbox report', {
        ...params,
        result
      });
    }
  };

  try {
    emitStep({
      step: 'validate_quest',
      status: 'started',
      message: 'Validating quest ownership and publish state'
    });

    const questLocal = resolveTable('quest', { localOverride: true });
    const [questLocalRow] = await system.db
      .select({
        id: questLocal.id,
        creator_id: questLocal.creator_id
      })
      .from(questLocal)
      .where(eq(questLocal.id, questId))
      .limit(1);

    if (!questLocalRow) {
      throw new Error('Quest not found in local table');
    }

    if (questLocalRow.creator_id !== profileId) {
      throw new Error('Profile is not the creator of this quest');
    }

    const questSynced = resolveTable('quest', { localOverride: false });
    const [questSyncedRow] = await system.db
      .select({ id: questSynced.id })
      .from(questSynced)
      .where(eq(questSynced.id, questId))
      .limit(1);

    if (!questSyncedRow) {
      throw new Error('Quest is not published yet');
    }

    emitStep({
      step: 'validate_quest',
      status: 'completed',
      message: 'Quest validation completed'
    });

    emitStep({
      step: 'scan_expected_audio',
      status: 'started',
      message: 'Scanning expected synced audio files'
    });

    const questAssetLinkSynced = resolveTable('quest_asset_link', {
      localOverride: false
    });
    const linkedAssets = await system.db
      .select({ asset_id: questAssetLinkSynced.asset_id })
      .from(questAssetLinkSynced)
      .where(eq(questAssetLinkSynced.quest_id, questId));

    const assetIds = Array.from(
      new Set(linkedAssets.map((row) => row.asset_id))
    );
    if (assetIds.length === 0) {
      emitStep({
        step: 'scan_expected_audio',
        status: 'completed',
        message: 'No assets linked to this quest'
      });
      report.success = true;
      emitStep({
        step: 'finish',
        status: 'completed',
        message: 'Recovery completed (no linked assets)'
      });
      return report;
    }

    const aclSynced = resolveTable('asset_content_link', {
      localOverride: false
    });
    const aclLocal = resolveTable('asset_content_link', {
      localOverride: true
    });

    const syncedRows = await system.db
      .select({
        id: aclSynced.id,
        asset_id: aclSynced.asset_id,
        audio: aclSynced.audio
      })
      .from(aclSynced)
      .where(inArray(aclSynced.asset_id, assetIds));

    const localRows = await system.db
      .select({
        id: aclLocal.id,
        asset_id: aclLocal.asset_id,
        audio: aclLocal.audio
      })
      .from(aclLocal)
      .where(inArray(aclLocal.asset_id, assetIds));

    const localAudioByAssetId = new Map<string, string[]>();
    for (const row of localRows) {
      const current = localAudioByAssetId.get(row.asset_id) ?? [];
      localAudioByAssetId.set(row.asset_id, [
        ...current,
        ...toAudioArray(row.audio)
      ]);
    }

    const expectedById = new Map<string, ExpectedAudioEntry>();
    for (const row of syncedRows) {
      for (const audioRawValue of toAudioArray(row.audio)) {
        const audioId = normalizeAudioId(audioRawValue);
        if (!audioId) continue;
        if (expectedById.has(audioId)) continue;
        expectedById.set(audioId, {
          assetId: row.asset_id,
          contentLinkId: row.id,
          audioRawValue,
          audioId,
          syncUri: getLocalAttachmentUri(audioId)
        });
      }
    }

    const expectedEntries = Array.from(expectedById.values());
    report.totalExpectedFiles = expectedEntries.length;

    for (const entry of expectedEntries) {
      const exists = await fileExists(entry.syncUri);
      if (!exists) {
        syncMissingEntries.push(entry);
      }
    }

    report.totalUnsyncedRecords = syncMissingEntries.length;
    pendingAudioIds.push(...syncMissingEntries.map((entry) => entry.audioId));

    emitStep({
      step: 'scan_expected_audio',
      status: 'completed',
      message: 'Expected audio scan completed',
      data: {
        totalExpectedFiles: report.totalExpectedFiles,
        totalUnsyncedRecords: report.totalUnsyncedRecords
      }
    });

    emitStep({
      step: 'copy_missing_to_sync',
      status: 'started',
      message: 'Copying missing files into synced attachment location'
    });

    for (const entry of syncMissingEntries) {
      try {
        const sourceUri = await tryResolveOriginalAudioUri(
          entry.audioRawValue,
          entry.audioId,
          entry.assetId,
          localAudioByAssetId
        );

        if (!sourceUri) {
          report.totalNotFoundOnDevice++;
          await reportRecoveryIssue({
            stage: 'move_file',
            errorCode: 'RECOVERY_SOURCE_NOT_FOUND',
            message: `Original source file not found for ${entry.audioId}`,
            attachmentId: entry.audioId,
            uri: entry.audioRawValue,
            metadata: {
              step: 'copy_missing_to_sync',
              assetId: entry.assetId
            }
          });
          continue;
        }

        await ensureDir(getDirectory(entry.syncUri));

        await copyFile(sourceUri, entry.syncUri);

        report.totalCopiedSuccessfully++;
        copiedEntries.push({
          audioId: entry.audioId,
          sourceUri,
          syncUri: entry.syncUri
        });
      } catch (error) {
        report.totalCopyErrors++;
        const message = `Copy failed for ${entry.audioId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(message);
        await reportRecoveryIssue({
          stage: 'move_file',
          errorCode: 'RECOVERY_COPY_ERROR',
          message,
          attachmentId: entry.audioId,
          uri: entry.audioRawValue,
          metadata: {
            step: 'copy_missing_to_sync',
            assetId: entry.assetId,
            targetUri: entry.syncUri
          }
        });
      }
    }

    emitStep({
      step: 'copy_missing_to_sync',
      status: 'completed',
      message: 'Copy step completed',
      data: {
        totalCopiedSuccessfully: report.totalCopiedSuccessfully,
        totalNotFoundOnDevice: report.totalNotFoundOnDevice,
        totalCopyErrors: report.totalCopyErrors
      }
    });

    emitStep({
      step: 'check_cloud',
      status: 'started',
      message: 'Checking whether files exist on cloud storage'
    });

    for (const entry of expectedEntries) {
      try {
        const existsInCloud = await cloudObjectExists(entry.audioId);
        if (!existsInCloud) {
          notFoundServerIds.add(entry.audioId);
        }
      } catch (error) {
        notFoundServerIds.add(entry.audioId);
        report.totalUploadSyncErrors++;
        const message = `Cloud check failed for ${entry.audioId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(message);
        await reportRecoveryIssue({
          stage: 'upload_file',
          errorCode: 'RECOVERY_CLOUD_CHECK_ERROR',
          message,
          attachmentId: entry.audioId,
          metadata: {
            step: 'check_cloud',
            assetId: entry.assetId
          }
        });
      }
    }

    report.totalNotFoundOnServer = notFoundServerIds.size;

    emitStep({
      step: 'check_cloud',
      status: 'completed',
      message: 'Cloud check completed',
      data: {
        totalNotFoundOnServer: report.totalNotFoundOnServer
      }
    });

    emitStep({
      step: 'queue_and_upload',
      status: 'started',
      message: 'Queuing missing cloud files for upload'
    });

    const permQueue = system.permAttachmentQueue;
    if (!permQueue && notFoundServerIds.size > 0) {
      report.totalUploadSyncErrors += notFoundServerIds.size;
      const message = 'Permanent attachment queue is not initialized';
      errors.push(message);
      await reportRecoveryIssue({
        stage: 'upload_file',
        errorCode: 'RECOVERY_QUEUE_NOT_INITIALIZED',
        message,
        metadata: {
          step: 'queue_and_upload',
          notFoundServerCount: notFoundServerIds.size
        }
      });
    } else if (permQueue) {
      for (const audioId of notFoundServerIds) {
        try {
          const syncUri = getLocalAttachmentUri(audioId);
          const exists = await fileExists(syncUri);
          if (!exists) {
            report.totalUploadSyncErrors++;
            const message = `Sync file missing for upload: ${audioId}`;
            errors.push(message);
            await reportRecoveryIssue({
              stage: 'upload_file',
              errorCode: 'RECOVERY_SYNC_FILE_MISSING',
              message,
              attachmentId: audioId,
              uri: syncUri,
              metadata: {
                step: 'queue_and_upload'
              }
            });
            continue;
          }

          const fileInfo = await getFileInfo(syncUri);
          const existingRecord = await permQueue.getExtendedRecord(audioId);
          if (!fileInfo.exists || typeof fileInfo.size !== 'number') {
            throw new Error(`Could not read file size for upload: ${audioId}`);
          }

          if (!existingRecord) {
            const record = await permQueue.newAttachmentRecord({ id: audioId });
            record.size = fileInfo.size;
            await permQueue.saveToQueue(record);
          } else if (
            existingRecord.state !== AttachmentState.SYNCED &&
            existingRecord.state !== AttachmentState.QUEUED_UPLOAD
          ) {
            await permQueue.update({
              ...existingRecord,
              state: AttachmentState.QUEUED_UPLOAD
            });
          }
        } catch (error) {
          report.totalUploadSyncErrors++;
          const message = `Queue failed for ${audioId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(message);
          await reportRecoveryIssue({
            stage: 'upload_file',
            errorCode: 'RECOVERY_QUEUE_ERROR',
            message,
            attachmentId: audioId,
            metadata: {
              step: 'queue_and_upload'
            }
          });
        }
      }

      if (notFoundServerIds.size > 0) {
        await permQueue.uploadRecordsWithProgress();
      }

      for (const audioId of notFoundServerIds) {
        try {
          const existsInCloudAfterUpload = await cloudObjectExists(audioId);
          if (existsInCloudAfterUpload) {
            uploadedAudioIds.push(audioId);
          } else {
            report.totalUploadSyncErrors++;
            await reportRecoveryIssue({
              stage: 'upload_file',
              errorCode: 'RECOVERY_UPLOAD_NOT_FOUND_AFTER_UPLOAD',
              message: `File still missing in cloud after upload attempt: ${audioId}`,
              attachmentId: audioId,
              metadata: {
                step: 'queue_and_upload'
              }
            });
          }
        } catch (error) {
          report.totalUploadSyncErrors++;
          const message = `Post-upload cloud check failed for ${audioId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(message);
          await reportRecoveryIssue({
            stage: 'upload_file',
            errorCode: 'RECOVERY_POST_UPLOAD_CHECK_ERROR',
            message,
            attachmentId: audioId,
            metadata: {
              step: 'queue_and_upload'
            }
          });
        }
      }
    }

    emitStep({
      step: 'queue_and_upload',
      status: 'completed',
      message: 'Queue/upload step completed',
      data: {
        uploadedAudioCount: uploadedAudioIds.length,
        totalUploadSyncErrors: report.totalUploadSyncErrors
      }
    });

    emitStep({
      step: 'delete_originals',
      status: 'started',
      message: 'Deleting original files after successful copy/upload'
    });

    const uploadedSet = new Set(uploadedAudioIds);
    const shouldDeleteOriginals = options?.deleteRecoveredOriginals ?? true;

    if (shouldDeleteOriginals) {
      for (const copied of copiedEntries) {
        if (!uploadedSet.has(copied.audioId)) {
          continue;
        }
        if (copied.sourceUri === copied.syncUri) {
          continue;
        }
        try {
          await deleteIfExists(copied.sourceUri);
          report.totalDeleted++;
        } catch (error) {
          report.totalDeleteErrors++;
          const message = `Delete failed for ${copied.audioId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(message);
          await reportRecoveryIssue({
            stage: 'save_record',
            errorCode: 'RECOVERY_DELETE_ERROR',
            message,
            attachmentId: copied.audioId,
            uri: copied.sourceUri,
            metadata: {
              step: 'delete_originals'
            }
          });
        }
      }
    }

    emitStep({
      step: 'delete_originals',
      status: 'completed',
      message: 'Delete step completed',
      data: {
        totalDeleted: report.totalDeleted,
        totalDeleteErrors: report.totalDeleteErrors
      }
    });

    report.success = errors.length === 0;
    emitStep({
      step: 'finish',
      status: report.success ? 'completed' : 'error',
      message: report.success
        ? 'Recovery completed successfully'
        : 'Recovery completed with errors',
      data: {
        errorCount: errors.length
      }
    });

    return report;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Unknown recovery error: ${String(error)}`;
    errors.push(message);
    await reportRecoveryIssue({
      stage: 'save_record',
      errorCode: 'RECOVERY_FATAL_ERROR',
      message,
      metadata: {
        step: 'finish'
      }
    });

    emitStep({
      step: 'finish',
      status: 'error',
      message,
      data: {
        errorCount: errors.length
      }
    });

    return report;
  }
}
