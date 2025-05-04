import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { Alert, Platform, AlertButton } from 'react-native';
// import * as SQLite from 'expo-sqlite/legacy'; // Removed SQLite import
import { requestBackupDirectory, ProgressCallback } from '@/utils/backupUtils';
import type { System } from '@/db/powersync/system'; // actual System instance type
import { project, quest, quest_asset_link, translation } from '@/db/drizzleSchema';
import { eq } from 'drizzle-orm';
// import { eq } from 'drizzle-orm'; // Removed drizzle import
// Import the specific translation types
import type { TranslationKey } from '@/services/translations';
import type { InterpolationOptions } from 'node-polyglot';

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

// Type for the translation function based on useTranslation hook
type TFunction = (key: TranslationKey, options?: number | InterpolationOptions) => string;

// Type for callbacks
type RestoreCallbacks = {
  onStart?: () => void;
  onFinish?: () => void;
  onProgress?: ProgressCallback;
};

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
          onPress: () => restoreFromBackup(
            system,
            currentUserId, // Pass userId down
            directoryUri,
            { restoreDb: false, restoreAudio: true },
            { onStart: undefined, onFinish, onProgress }
          )
        }
      ],
      { cancelable: true, onDismiss: onFinish }
    );

  } catch (error: any) {
    console.error('[selectAndInitiateRestore] Error:', error);
    Alert.alert(t('error'), t('failedRestore', { error: error.message }));
    onFinish?.();
  }
}

/**
 * Performs the AUDIO-ONLY restore from a chosen backup directory.
 */
async function restoreFromBackup(
  system: System,
  currentUserId: string, // Add userId parameter
  backupDirectoryUri: string,
  options: { restoreDb?: boolean; restoreAudio?: boolean } = { restoreDb: false, restoreAudio: true }, // Keep structure, but restoreDb is always false
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
    const fileUris = await StorageAccessFramework.readDirectoryAsync(backupDirectoryUri);
    console.log(`[restoreFromBackup] Files in backup directory: ${fileUris.join(', ')}`);

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
    let audioCopied = 0, audioSkipped = 0; // Renamed audioSkipped for clarity
    if (options.restoreAudio) { // This will always be true now
      console.log('[restoreFromBackup] Starting audio file restore');
      const localAttachmentsDir = (FileSystem.documentDirectory || '') + 'shared_attachments/'; // Target shared_attachments
      try { await FileSystem.makeDirectoryAsync(localAttachmentsDir, { intermediates: true }); } catch {}
      
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

        // Extract the 36-char assetId UUID from the start of the filename
        const fileBase = fileName.split('.')[0]; // Remove extensions
        const idMatch = fileBase.match(/^([0-9a-fA-F-]{36})(?:_|-)/);
        if (!idMatch) {
          console.warn(`[restoreFromBackup] Could not parse assetId from filename: ${fileName}`);
          audioSkipped++;
          callbacks?.onProgress?.(index + 1, totalFiles);
          continue;
        }
        const assetIdFromFile = idMatch[1];

        try {
          // Use the passed-in userId
          const creatorId = currentUserId;

          // Get target language ID via Asset -> Quest Link -> Quest -> Project
          const questLink = await system.db.query.quest_asset_link.findFirst({
            where: (q) => eq(q.asset_id, assetIdFromFile),
            columns: { quest_id: true }
          });
          if (!questLink) {
            throw new Error(`Could not find quest link for asset ${assetIdFromFile}`);
          }
          const questRecord = await system.db.query.quest.findFirst({
            where: (q) => eq(q.id, questLink.quest_id),
            columns: { project_id: true }
          });
          if (!questRecord) {
            throw new Error(`Could not find quest ${questLink.quest_id} linked to asset ${assetIdFromFile}`);
          }
          const projectRecord = await system.db.query.project.findFirst({
            where: (p) => eq(p.id, questRecord.project_id),
            columns: { target_language_id: true }
          });
          if (!projectRecord || !projectRecord.target_language_id) {
            throw new Error(`Could not find target language for asset ${assetIdFromFile}`);
          }
          const targetLanguageId = projectRecord.target_language_id;

          const contentBase64 = await StorageAccessFramework.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64
          });
          const tempFileUri = (FileSystem.cacheDirectory || '') + fileName;
          await FileSystem.writeAsStringAsync(tempFileUri, contentBase64, {
            encoding: FileSystem.EncodingType.Base64
          });
          if (!system.permAttachmentQueue) {
            throw new Error('Permanent attachment queue not initialized');
          }
          const attachmentRecord = await system.permAttachmentQueue.saveAudio(tempFileUri);
          
          // Insert into translation table instead of asset_content_link
          await system.db.insert(translation).values({
            asset_id: assetIdFromFile,
            audio: attachmentRecord.id, // Use the new audio ID
            creator_id: creatorId,
            target_language_id: targetLanguageId,
            text: '[Restored Audio]' // Placeholder text
          });
          audioCopied++;
        } catch (err: any) {
          console.error(`[restoreFromBackup] Failed to restore audio ${fileName}:`, err);
          audioSkipped++;
        }
        callbacks?.onProgress?.(index + 1, totalFiles);
      }
      console.log(`[restoreFromBackup] Audio restore completed: ${audioCopied} copied, ${audioSkipped} skipped.`);
    } else {
      // This block should technically not be reachable if options.restoreAudio is always true
      console.log('[restoreFromBackup] Audio files restore skipped? (This shouldn\'t happen)')
    }
    
    // Simplified completion message
    const completeMessage = `Audio files: ${audioCopied} restored, ${audioSkipped} skipped.`;
    
    Alert.alert('Restore Complete', completeMessage);
  } catch (error: any) {
    console.error('[restoreFromBackup] Error during restore:', error);
    Alert.alert('Restore Failed', `An error occurred: ${error.message}`);
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