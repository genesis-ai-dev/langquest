import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { Alert, Platform, AlertButton } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { requestBackupDirectory } from '@/utils/backupUtils';
import type { System } from '@/db/powersync/system'; // actual System instance type
import { eq } from 'drizzle-orm';

// Import your Drizzle schemas (ensure these paths are correct)
import { 
    project as projectSchema,
    quest as questSchema,
    asset as assetSchema,
    translation as translationSchema,
    asset_content_link as assetContentLinkSchema 
} from '@/db/drizzleSchema';

// Define the tables and their schemas in the desired processing order
const tablesToMerge = [
    { name: 'project', schema: projectSchema },
    { name: 'quest', schema: questSchema },
    { name: 'asset', schema: assetSchema },
    { name: 'translation', schema: translationSchema },
    { name: 'asset_content_link', schema: assetContentLinkSchema },
    // Add other tables if necessary, respecting dependencies
];

// Import helper functions potentially refactored from backupUtils
// import { getAudioAssetMapFromDb, getAssetNameFromDb, sanitizeAssetName } from '@/utils/backupUtils'; // Need to refactor these in backupUtils first

// Type for callbacks
type RestoreCallbacks = {
  onStart?: () => void;
  onFinish?: () => void;
};

// --- Helper Functions (Adapted for Backup DB) ---

function sanitizeAssetName(name: string): string {
    // Simple sanitization, consistent with backupUtils
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function getAssetNameFromBackupDb(backupDb: SQLite.SQLiteDatabase, assetId: string): Promise<string> {
    const defaultName = 'unknown_asset';
    try {
        // Use explicit transaction for reading
        const results = await backupDb.execAsync([
            { sql: 'SELECT name FROM asset WHERE id = ? LIMIT 1;', args: [assetId] }
        ], true); // true for readOnly
        
        const firstResult = results[0];
        if ('rows' in firstResult && firstResult.rows.length > 0) {
            return firstResult.rows[0].name || defaultName;
        } else {
            // Handle potential error objects if execAsync structure returns them
            if ('error' in firstResult) {
                console.error('Error querying asset name from backup DB:', firstResult.error);
            }
            return defaultName;
        }
    } catch (error) {
        console.error('Failed to get asset name from backup DB:', error);
        return defaultName;
    }
}

async function getAudioAssetMapFromBackupDb(backupDb: SQLite.SQLiteDatabase): Promise<Map<string, string>> {
    const audioAssetMap = new Map<string, string>();
    try {
        // Query translations with audio
        const translationResults = await backupDb.execAsync([
            { sql: 'SELECT audio, asset_id FROM translation WHERE audio IS NOT NULL;', args: [] }
        ], true);
        
        const firstTResult = translationResults[0];
        if ('rows' in firstTResult) {
            firstTResult.rows.forEach((t: { audio: string | null; asset_id: string | null }) => {
                 // Ensure audio and asset_id are treated as strings, matching Map definition
                const audioId = t.audio ? String(t.audio) : null;
                const assetId = t.asset_id ? String(t.asset_id) : null;
                if (audioId && assetId && !audioAssetMap.has(audioId)) {
                    audioAssetMap.set(audioId, assetId);
                }
            });
        } else if ('error' in firstTResult) {
            console.error('Error querying translations from backup DB:', firstTResult.error);
        }

        // Query asset_content_links with audio
        const linkResults = await backupDb.execAsync([
            { sql: 'SELECT audio_id, asset_id FROM asset_content_link WHERE audio_id IS NOT NULL;', args: [] }
        ], true);

        const firstLResult = linkResults[0];
         if ('rows' in firstLResult) {
            firstLResult.rows.forEach((l: { audio_id: string | null; asset_id: string | null }) => {
                const audioId = l.audio_id ? String(l.audio_id) : null;
                const assetId = l.asset_id ? String(l.asset_id) : null;
                if (audioId && assetId && !audioAssetMap.has(audioId)) {
                    audioAssetMap.set(audioId, assetId);
                }
            });
        } else if ('error' in firstLResult) {
            console.error('Error querying asset_content_links from backup DB:', firstLResult.error);
        }

    } catch (error) {
        console.error('Failed to get audio-asset map from backup DB:', error);
        // Return potentially partial map or empty map depending on desired robustness
    }
    return audioAssetMap;
}

// --- Main Restore Logic ---

/**
 * Initiates the backup selection process.
 */
export async function selectAndInitiateRestore(
  system: System,
  t: (key: string, values?: any) => string,
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
    
    // Show options for what to restore
    Alert.alert(
      t('restoreOptions'),
      t('whatToRestore'),
      [
        { 
          text: t('cancel'), 
          style: 'cancel', 
          onPress: onFinish 
        },
        { 
          text: t('restoreAudioOnly'), 
          onPress: () => {
            Alert.alert(
              t('confirmAudioRestore'),
              t('confirmAudioRestoreMessage'),
              [
                { text: t('cancel'), style: 'cancel', onPress: onFinish },
                { 
                  text: t('restoreAudioOnly'), 
                  onPress: () => restoreFromBackup(
                    system, 
                    directoryUri, 
                    { restoreDb: false, restoreAudio: true }, 
                    { onStart: undefined, onFinish }
                  )
                }
              ]
            );
          }
        },
        { 
          text: t('restoreEverything'), 
          onPress: () => {
            Alert.alert(
              t('confirmFullRestore'),
              t('confirmFullRestoreMessage'),
              [
                { text: t('cancel'), style: 'cancel', onPress: onFinish },
                { 
                  text: t('restoreEverything'), 
                  onPress: () => restoreFromBackup(
                    system, 
                    directoryUri, 
                    { restoreDb: true, restoreAudio: true }, 
                    { onStart: undefined, onFinish }
                  )
                }
              ]
            );
          }
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
 * Performs the append-only restore from a chosen backup directory.
 */
async function restoreFromBackup(
  system: System,
  backupDirectoryUri: string,
  options: { restoreDb?: boolean; restoreAudio?: boolean } = { restoreDb: true, restoreAudio: true },
  callbacks?: RestoreCallbacks
) {
  // onStart was likely called before the confirmation Alert in selectAndInitiateRestore
  // If needed, call it here: callbacks?.onStart?.(); 
  const whatRestoring = options.restoreDb && options.restoreAudio 
    ? 'everything'
    : options.restoreDb 
      ? 'database' 
      : 'audio files';
  
  Alert.alert('Restore Started', `Restoring ${whatRestoring}...`);

  const tempDbName = 'restore_temp.db';
  const tempDbPath = (FileSystem.cacheDirectory || '') + tempDbName;
  let backupDb: SQLite.WebSQLDatabase | null = null;

  try {
    // Read available files first
    const fileUris = await StorageAccessFramework.readDirectoryAsync(backupDirectoryUri);
    console.log(`[restoreFromBackup] Files in backup directory: ${fileUris.join(', ')}`);

    // --- 1. Database Restore (if selected) ---
    if (options.restoreDb) {
      console.log('[restoreFromBackup] Copying backup sqlite.db from flat directory');
      
      // Locate sqlite.db by decoding and extracting actual filename
      let dbUri: string | undefined;
      for (const uri of fileUris) {
        const encoded = uri.split('/').pop()!;
        const decoded = decodeURIComponent(encoded);
        const name = decoded.split('/').pop();
        if (name === 'sqlite.db') {
          dbUri = uri;
          break;
        }
      }
      
      if (!dbUri) {
        console.warn('[restoreFromBackup] sqlite.db not found in backup directory. Skipping database restore.');
      } else {
        const dbContent = await StorageAccessFramework.readAsStringAsync(dbUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(tempDbPath, dbContent, { encoding: FileSystem.EncodingType.Base64 });
        console.log(`[restoreFromBackup] Backup DB copied to temp path: ${tempDbPath}`);
        
        // Open the copied DB using the correct Expo SQLite async API
        backupDb = SQLite.openDatabase(tempDbName);
        console.log('[restoreFromBackup] Backup database opened.');

        // Helper to get all rows from a table using async/await
        function getAllRowsAsync(db, tableName) {
          return new Promise((resolve, reject) => {
            db.transaction(tx => {
              tx.executeSql(
                `SELECT * FROM ${tableName};`,
                [],
                (_, result) => resolve(result.rows._array),
                (_, error) => { reject(error); return false; }
              );
            });
          });
        }
        
        // --- 2. Merge Database Records (Append Only) ---
        console.log('[restoreFromBackup] Starting database merge');
        
        for (const { name: tableName, schema: tableSchema } of tablesToMerge) {
          console.log(`Merging table: ${tableName}...`);
          let insertedCount = 0;
          let skippedCount = 0;

          try {
            // Query all records from the backup table using async helper
            const rows = await getAllRowsAsync(backupDb, tableName);
            for (const backupRecord of rows) {
              if (!backupRecord.id) {
                console.warn(`Skipping record in backup table ${tableName} due to missing ID:`, backupRecord);
                skippedCount++;
                continue;
              }
              try {
                // Generate a new UUID for this record to ensure it's always appended
                const originalId = backupRecord.id;
                const newId = crypto.randomUUID();
                console.log(`[restoreFromBackup] Appending record from table ${tableName}: original ID ${originalId} → new ID ${newId}`);
                // Clone the record and assign a new ID to avoid conflicts
                const recordToInsert = {
                  ...backupRecord,
                  id: newId
                };
                // Always insert the record with the new ID
                await system.db.insert(tableSchema).values(recordToInsert).execute();
                insertedCount++;
              } catch (dbError) {
                console.error(`Error processing record ID ${backupRecord.id} in table ${tableName}:`, dbError);
                skippedCount++;
              }
            }
            console.log(`Finished merging ${tableName}: ${insertedCount} inserted, ${skippedCount} skipped.`);
          } catch (queryError) {
            console.error(`Failed to process backup table ${tableName}:`, queryError);
          }
        }
        console.log('[restoreFromBackup] Database merge completed.');
      }
    } else {
      console.log('[restoreFromBackup] Database restore skipped by user selection.');
    }

    // --- 3. Audio Files Restore (if selected) ---
    let audioCopied = 0, audioSkipped = 0;
    if (options.restoreAudio) {
      console.log('[restoreFromBackup] Starting audio file merge from flat backup');
      const localAttachmentsDir = (FileSystem.documentDirectory || '') + 'attachments/';
      try { await FileSystem.makeDirectoryAsync(localAttachmentsDir, { intermediates: true }); } catch {}
      
      // Filter out sqlite.db
      const audioUris = fileUris.filter(uri => {
        const encoded = uri.split('/').pop()!;
        const decoded = decodeURIComponent(encoded);
        const name = decoded.split('/').pop();
        return name !== 'sqlite.db';
      });
      
      for (const fileUri of audioUris) {
        // Extract actual filename
        const encoded = fileUri.split('/').pop()!;
        const decoded = decodeURIComponent(encoded);
        const fileName = decoded.split('/').pop()!;
        const destPath = localAttachmentsDir + fileName;
        try {
          // Check if file already exists
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
          
          const content = await StorageAccessFramework.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(finalDestPath, content, { encoding: FileSystem.EncodingType.Base64 });
          audioCopied++;
        } catch (err: any) {
          console.error(`[restoreFromBackup] Failed to restore audio ${fileName}:`, err);
        }
      }
      console.log(`[restoreFromBackup] Audio restore completed: ${audioCopied} copied, ${audioSkipped} skipped.`);
    } else {
      console.log('[restoreFromBackup] Audio files restore skipped by user selection.');
    }
    
    // Prepare completion message based on what was restored
    let completeMessage = '';
    if (options.restoreDb && options.restoreAudio) {
      completeMessage = `Database merged. Audio files: ${audioCopied} restored, ${audioSkipped} skipped.`;
    } else if (options.restoreDb) {
      completeMessage = 'Database merged successfully.';
    } else if (options.restoreAudio) {
      completeMessage = `Audio files: ${audioCopied} restored, ${audioSkipped} skipped.`;
    }
    
    Alert.alert('Restore Complete', completeMessage);
  } catch (error: any) {
    console.error('[restoreFromBackup] Error during restore:', error);
    Alert.alert('Restore Failed', `An error occurred: ${error.message}`);
  } finally {
    // Cleanup temp DB file
    if (backupDb) {
      // No explicit close in expo-sqlite
    }
    try {
      const tempFileInfo = await FileSystem.getInfoAsync(tempDbPath);
      if (tempFileInfo.exists) await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
    } catch {}
    callbacks?.onFinish?.(); 
  }
} 