import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { Alert, Platform } from 'react-native';
// import * as SQLite from 'expo-sqlite/legacy'; // Removed SQLite import
import type { System } from '@/db/powersync/system'; // actual System instance type
import type { ProgressCallback } from '@/utils/backupUtils';
import { requestBackupDirectory } from '@/utils/backupUtils';
import { and, eq, isNotNull } from 'drizzle-orm';
// import { eq } from 'drizzle-orm'; // Removed drizzle import
// Import the specific translation types
import { asset, asset_content_link } from '@/db/drizzleSchema';
import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import type { LocalizationKey } from '@/services/localizations';
import { resolveTable } from './dbUtils';
// Removed InterpolationOptions as node-polyglot is not a direct/typed dependency here or its types are missing

// Removed Drizzle schema imports
/*
import {
    project as projectSchema,
    // ... other schemas ...
} from '@/db/drizzleSchema';
*/

// Removed tablesToMerge array
/*
const tablesToMerge = [
    // ... table definitions ...
];
*/

// Removed backup DB helper functions
/*
function sanitizeAssetName(name: string): string {
    // ... implementation removed ...
}

async function getAssetNameFromBackupDb(backupDb: SQLite.WebSQLDatabase, assetId: string): Promise<string> {
    // ... implementation removed ...
}

async function getAudioAssetMapFromBackupDb(backupDb: SQLite.WebSQLDatabase): Promise<Map<string, string>> {
    // ... implementation removed ...
}
*/

// Type for the translation function based on useLocalization hook
type TFunction = (
  key: LocalizationKey,
  options?: Record<string, string | number> | number
) => string;

// Type for callbacks
interface RestoreCallbacks {
  onStart?: () => void;
  onFinish?: () => void;
  onProgress?: ProgressCallback;
}

// --- Main Restore Logic ---

/**
 * Initiates the backup selection process for AUDIO ONLY.
 */
export async function selectAndInitiateRestore(
  system: System, // Keep system for restore logic
  currentUserId: string, // Add userId parameter
  t: TFunction, // Use the specific TFunction type
  onStart?: () => void,
  onFinish?: () => void,
  onProgress?: ProgressCallback
) {
  if (Platform.OS !== 'android') {
    Alert.alert(t('error'), t('restoreAndroidOnly'));
    onFinish?.();
    return;
  }
  // Indicate start
  onStart?.();
  try {
    // Prompt user to select the backup directory
    const directoryUri = await requestBackupDirectory();
    if (!directoryUri) {
      Alert.alert(t('permissionDenied'), t('storagePermissionDenied'));
      onFinish?.();
      return;
    }

    // Confirm Audio-Only Restore
    Alert.alert(
      t('confirmAudioRestore'), // Use existing audio confirm title
      t('confirmAudioRestoreMessage'), // Use existing audio confirm message
      [
        { text: t('cancel'), style: 'cancel', onPress: onFinish },
        {
          text: t('restoreAudioOnly'), // Button text confirms action
          onPress: () =>
            void restoreFromBackup(
              system,
              currentUserId, // Pass userId down
              t, // Pass t function down
              directoryUri,
              { restoreDb: false, restoreAudio: true },
              { onStart: undefined, onFinish, onProgress }
            )
        }
      ],
      { cancelable: true, onDismiss: onFinish }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[selectAndInitiateRestore] Error:', errorMessage);
    Alert.alert(t('error'), t('failedRestore', { error: errorMessage }));
    onFinish?.();
  }
}

/**
 * Performs the AUDIO-ONLY restore from a chosen backup directory.
 */
async function restoreFromBackup(
  system: System,
  currentUserId: string, // Add userId parameter
  t: TFunction, // Add t parameter
  backupDirectoryUri: string,
  options: { restoreDb?: boolean; restoreAudio?: boolean } = {
    restoreDb: false,
    restoreAudio: true
  }, // Keep structure, but restoreDb is always false
  callbacks?: RestoreCallbacks
) {
  const whatRestoring = 'audio files'; // Simplified

  Alert.alert('Restore Started', `Restoring ${whatRestoring}...`);

  // Removed temp DB variables
  // const tempDbName = 'restore_temp.db';
  // const tempDbPath = (FileSystem.cacheDirectory || '') + tempDbName;
  // let backupDb: SQLite.WebSQLDatabase | null = null;

  try {
    // Read available files first
    const fileUris =
      await StorageAccessFramework.readDirectoryAsync(backupDirectoryUri);
    console.log(
      `[restoreFromBackup] Files in backup directory: ${fileUris.join(', ')}`
    );

    // --- Database Restore Section REMOVED ---
    /*
    if (options.restoreDb) {
      // ... entire DB restore logic removed ...
    } else {
      console.log('[restoreFromBackup] Database restore skipped by user selection.');
    }
    */
    console.log('[restoreFromBackup] Skipping database restore (audio-only).');

    // --- Audio Files Restore (Now the main part) ---
    let audioCopied = 0,
      audioSkippedDueToError = 0,
      audioSkippedLocally = 0;
    if (options.restoreAudio) {
      // This will always be true now
      console.log('[restoreFromBackup] Starting audio file restore');
      const localAttachmentsDir =
        (FileSystem.documentDirectory ?? '') +
        `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/`; // Target shared_attachments
      try {
        await FileSystem.makeDirectoryAsync(localAttachmentsDir, {
          intermediates: true
        });
      } catch (e) {
        console.warn(
          '[restoreFromBackup] Failed to ensure attachments directory, may already exist:',
          e instanceof Error ? e.message : String(e)
        );
      }

      // No need to filter out sqlite.db anymore, but filtering non-audio might be good?
      const totalFiles = fileUris.length;

      // Report initial progress
      callbacks?.onProgress?.(0, totalFiles);

      for (const [index, fileUri] of fileUris.entries()) {
        const encoded = fileUri.split('/').pop()!;
        const decodedSegment = decodeURIComponent(encoded);
        // Extract the actual filename after the last '/' if present
        const fileName = decodedSegment.includes('/')
          ? decodedSegment.substring(decodedSegment.lastIndexOf('/') + 1)
          : decodedSegment;

        // 1. Extract Asset ID (first 36 chars, should be a UUID)
        if (fileName.length < 36 + 1 + 1 + 1) {
          // assetId(36) + _ + baseId(1) + . + ext(1)
          console.warn(
            `[restoreFromBackup] Filename too short to be a valid backup: ${fileName}`
          );
          audioSkippedDueToError++;
          callbacks?.onProgress?.(index + 1, totalFiles);
          continue;
        }
        const assetIdFromFile = fileName.substring(0, 36);
        if (fileName.charAt(36) !== '_') {
          // Check for underscore after assetId
          console.warn(
            `[restoreFromBackup] Backup filename missing underscore after assetId: ${fileName}`
          );
          audioSkippedDueToError++;
          callbacks?.onProgress?.(index + 1, totalFiles);
          continue;
        }

        // 2. Isolate the part after "assetId_"
        const remainingAfterAssetId = fileName.substring(37);

        // Find the last dot to separate baseAudioId from extension
        const lastDotIndex = remainingAfterAssetId.lastIndexOf('.');

        let originalBaseAudioId: string;
        let originalExtension = 'm4a'; // Default

        if (lastDotIndex === -1) {
          // No extension found, use entire remaining part as baseAudioId
          originalBaseAudioId = remainingAfterAssetId;
        } else {
          // Split baseAudioId and extension
          originalBaseAudioId = remainingAfterAssetId.substring(
            0,
            lastDotIndex
          );
          originalExtension = remainingAfterAssetId.substring(lastDotIndex + 1);
        }

        if (!originalBaseAudioId) {
          console.warn(
            `[restoreFromBackup] Could not parse originalBaseAudioId from: ${fileName}`
          );
          audioSkippedDueToError++;
          callbacks?.onProgress?.(index + 1, totalFiles);
          continue;
        }

        // Check if this audio is already logically linked as a translation for this asset
        const originalAudioFullId = `${originalBaseAudioId}.${originalExtension}`;

        const [existingAsset] = await system.db
          .select({
            id: asset.id,
            audio: asset_content_link.audio
          })
          .from(asset)
          .where(
            and(
              eq(asset.id, assetIdFromFile),
              isNotNull(asset_content_link.audio),
              eq(asset_content_link.audio, [originalAudioFullId])
            )
          )
          .leftJoin(
            asset_content_link,
            eq(asset.id, asset_content_link.asset_id)
          )
          .limit(1);

        if (existingAsset) {
          console.log(
            `[restoreFromBackup] Translation with audio ID ${originalAudioFullId} already exists for asset ${assetIdFromFile}. Skipping restore.`
          );
          audioSkippedLocally++;
          callbacks?.onProgress?.(index + 1, totalFiles);
          continue;
        }

        try {
          // Use the passed-in userId
          const creatorId = currentUserId;

          // Get target language ID via Asset -> Quest Link -> Quest -> Project
          const questLink = await system.db.query.quest_asset_link.findFirst({
            where: (q) => eq(q.asset_id, assetIdFromFile),
            columns: { quest_id: true }
          });
          if (!questLink) {
            throw new Error(
              `Could not find quest link for asset ${assetIdFromFile}`
            );
          }
          const questRecord = await system.db.query.quest.findFirst({
            where: (q) => eq(q.id, questLink.quest_id),
            columns: { project_id: true }
          });
          if (!questRecord) {
            throw new Error(
              `Could not find quest ${questLink.quest_id} linked to asset ${assetIdFromFile}`
            );
          }
          const projectRecord = await system.db.query.project.findFirst({
            where: (p) => eq(p.id, questRecord.project_id),
            columns: { target_language_id: true }
          });
          if (!projectRecord?.target_language_id) {
            throw new Error(
              `Could not find target language for asset ${assetIdFromFile}`
            );
          }
          const targetLanguageId = projectRecord.target_language_id;

          const contentBase64 = await StorageAccessFramework.readAsStringAsync(
            fileUri,
            {
              encoding: FileSystem.EncodingType.Base64
            }
          );
          const tempFileUri = (FileSystem.cacheDirectory ?? '') + fileName;
          await FileSystem.writeAsStringAsync(tempFileUri, contentBase64, {
            encoding: FileSystem.EncodingType.Base64
          });
          if (!system.permAttachmentQueue) {
            throw new Error('Permanent attachment queue not initialized');
          }
          const attachmentRecord =
            await system.permAttachmentQueue.saveAudio(tempFileUri);

          // Insert into asset_content_link table instead of translation
          await system.db.insert(resolveTable('asset_content_link')).values({
            asset_id: assetIdFromFile,
            audio: [attachmentRecord.id], // Use the new audio ID
            source_language_id: targetLanguageId,
            download_profiles: [creatorId]
          });
          audioCopied++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(
            `[restoreFromBackup] Failed to restore audio ${fileName}:`,
            errorMessage
          );
          audioSkippedDueToError++;
        }
        callbacks?.onProgress?.(index + 1, totalFiles);
      }
      console.log(
        `[restoreFromBackup] Audio restore completed: ${audioCopied} copied, ${audioSkippedDueToError} skipped due to errors, ${audioSkippedLocally} skipped (local).`
      );
    } else {
      // This block should technically not be reachable if options.restoreAudio is always true
      console.log(
        "[restoreFromBackup] Audio files restore skipped? (This shouldn't happen)"
      );
    }

    let completeMessage = t('restoreCompleteBase', {
      audioCopied: audioCopied.toString(),
      audioSkippedDueToError: audioSkippedDueToError.toString()
    });

    if (audioSkippedLocally > 0) {
      const locallySkippedMessage = t('restoreSkippedLocallyPart', {
        audioSkippedLocally: audioSkippedLocally.toString()
      });
      completeMessage += ` ${locallySkippedMessage}`;
    }

    Alert.alert(t('restoreCompleteTitle'), completeMessage);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[restoreFromBackup] Error during restore:', errorMessage);
    Alert.alert(t('restoreFailedTitle', { error: errorMessage }));
  } finally {
    // Cleanup temp DB file (removed)
    /*
    if (backupDb) {
      // No explicit close in expo-sqlite/legacy
    }
    try {
      const tempFileInfo = await FileSystem.getInfoAsync(tempDbPath);
      if (tempFileInfo.exists) await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
    } catch {}
    */
    callbacks?.onFinish?.();
  }
}
