import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { Alert, Platform, AlertButton } from 'react-native';
// import * as SQLite from 'expo-sqlite/legacy'; // Removed SQLite import
import { requestBackupDirectory } from '@/utils/backupUtils';
import type { System } from '@/db/powersync/system'; // actual System instance type
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
};

// --- Main Restore Logic ---

/**
 * Initiates the backup selection process for AUDIO ONLY.
 */
export async function selectAndInitiateRestore(
  system: System, // Keep system if needed for future audio checks?
  t: TFunction, // Use the specific TFunction type
  onStart?: () => void,
  onFinish?: () => void
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
            // system, // Pass system only if needed later
            directoryUri,
            { restoreDb: false, restoreAudio: true }, // Options are now fixed
            { onStart: undefined, onFinish }
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
  // system: System, // Removed system if not needed
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
      const audioUris = fileUris; // Keep it simple for now, assume backup dir is clean
      
      for (const fileUri of audioUris) {
        // Extract actual filename
        const encoded = fileUri.split('/').pop()!;
        const decoded = decodeURIComponent(encoded);
        const fileName = decoded.split('/').pop()!;
        const destPath = localAttachmentsDir + fileName;

        // Skip potential db files explicitly if they exist
        if (fileName === 'sqlite.db' || fileName.startsWith('sqlite.db (')) {
             console.log(`[restoreFromBackup] Skipping potential DB file: ${fileName}`);
             continue;
        }

        try {
          // Check if file already exists in the target directory
          const fileExists = (await FileSystem.getInfoAsync(destPath, { size: true })).exists;
          
          let finalDestPath = destPath;
          if (fileExists) {
            // If file exists, create a unique name by adding a timestamp suffix
            const fileExt = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
            const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
            const timestamp = Date.now();
            finalDestPath = localAttachmentsDir + baseName + '_restored_' + timestamp + fileExt;
            console.log(`[restoreFromBackup] File ${fileName} already exists, saving as ${baseName}_restored_${timestamp}${fileExt}`);
          }
          
          // Copy the file (assuming Base64 encoding from backup, might need adjustment)
          // If backup used FileSystem.copyAsync, restore should use that too.
          // Let's assume Base64 for now based on previous code.
          const content = await StorageAccessFramework.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(finalDestPath, content, { encoding: FileSystem.EncodingType.Base64 });
          audioCopied++;
        } catch (err: any) {
          console.error(`[restoreFromBackup] Failed to restore audio ${fileName}:`, err);
          audioSkipped++; // Increment skipped count on error
        }
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