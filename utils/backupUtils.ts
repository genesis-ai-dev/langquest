import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { getFilesInUploadQueue } from '@/utils/attachmentUtils';
import { translation as translationSchema, asset_content_link as assetContentLinkSchema, asset as assetSchema } from '@/db/drizzleSchema';
import { isNotNull, eq } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage key for the backup directory URI
const BACKUP_DIRECTORY_URI_KEY = 'BACKUP_DIRECTORY_URI';

// --- Utilities moved from Drawer.tsx ---

// Note: These now live outside component scope, ensure 'system' is passed if needed.
function sanitizeAssetName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function getAssetName(system: any, assetId: string): Promise<string> {
    try {
        const assetRecord = await system.db.query.asset.findFirst({
            where: eq(assetSchema.id, assetId)
        });
        return assetRecord?.name || 'unknown_asset';
    } catch {
        return 'unknown_asset';
    }
}

async function getAudioAssetMap(system: any): Promise<Map<string, string>> {
    const translationsWithAudio = await system.db.select({
        audioId: translationSchema.audio,
        assetId: translationSchema.asset_id
    }).from(translationSchema)
        .where(isNotNull(translationSchema.audio))
        .all();
    const contentLinksWithAudio = await system.db.select({
        audioId: assetContentLinkSchema.audio_id,
        assetId: assetContentLinkSchema.asset_id
    }).from(assetContentLinkSchema)
        .where(isNotNull(assetContentLinkSchema.audio_id))
        .all();
    const audioAssetMap = new Map<string, string>();
    translationsWithAudio.forEach((t: { audioId: string | null; assetId: string | null }) => {
        if (t.audioId && t.assetId && !audioAssetMap.has(t.audioId)) {
            audioAssetMap.set(t.audioId, t.assetId);
        }
    });
    contentLinksWithAudio.forEach((l: { audioId: string | null; assetId: string | null }) => {
        if (l.audioId && l.assetId && !audioAssetMap.has(l.audioId)) {
            audioAssetMap.set(l.audioId, l.assetId);
        }
    });
    return audioAssetMap;
}

// --- Permission Helper ---
export async function requestBackupDirectory(): Promise<string | null> {
  // Android-specific permission handling - return null for other platforms
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    // First, try to get previously saved directory URI
    const savedDirectoryUri = await AsyncStorage.getItem(BACKUP_DIRECTORY_URI_KEY);
    
    // If we have a previously saved URI, verify it's still valid
    if (savedDirectoryUri) {
      try {
        // Try to list files to validate permission is still valid
        await StorageAccessFramework.readDirectoryAsync(savedDirectoryUri);
        console.log('Using existing backup directory permission');
        return savedDirectoryUri;
      } catch (error) {
        console.log('Saved directory permission expired, requesting new permissions');
        // Continue to request new permissions
      }
    }
    
    // Request new permissions
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions?.granted && permissions.directoryUri) {
      try {
        // Take persistent permissions for this URI - THIS IS HANDLED BY THE SYSTEM/EXPO WHEN REQUESTING
        // await StorageAccessFramework.persistPermissionsForDirectoryAsync(
        //   permissions.directoryUri,
        //   [StorageAccessFramework.Permission.READ, StorageAccessFramework.Permission.WRITE]
        // );
        
        // Store the URI in AsyncStorage for future use
        await AsyncStorage.setItem(BACKUP_DIRECTORY_URI_KEY, permissions.directoryUri);
        console.log('Saved new backup directory permission');
        return permissions.directoryUri;
      } catch (persistError) {
        console.error('Failed to persist permissions:', persistError);
        // Still return the directory URI even if we couldn't persist it
        return permissions.directoryUri;
      }
    } else {
      return null; // Permission denied or URI missing
    }
  } catch (dirError) {
    console.error('Error during directory permission request:', dirError);
    throw dirError; // Re-throw to be handled by the caller
  }
}

// --- Path Preparation Helper ---
export function prepareBackupPaths(timestamp: string): {
  mainBackupDirName: string;
  dbFullPathName: string;
  audioBaseDirPath: string;
  dbSourceUri: string;
} {
  const mainBackupDirName = `backup_${timestamp}`;
  const dbFullPathName = `${mainBackupDirName}/database/sqlite.db`;
  const audioBaseDirPath = `${mainBackupDirName}/audio_files`;
  const dbSourceUri = (FileSystem.documentDirectory || '') + 'sqlite.db';
  return { mainBackupDirName, dbFullPathName, audioBaseDirPath, dbSourceUri };
}

// --- Backup Helper: Database ---
export async function backupDatabase(
    baseDirectoryUri: string,
    dbFullPathName: string,
    dbSourceUri: string
): Promise<{ statusKey: 'backupDbStatusSkipped' | 'backupDbStatusSuccessful' | 'backupDbStatusFailed', error?: string }> {
    try {
        const dbFileInfo = await FileSystem.getInfoAsync(dbSourceUri);
        if (dbFileInfo.exists) {
            // Get directory path from the full file path (everything before the last /)
            const dbDirPath = dbFullPathName.substring(0, dbFullPathName.lastIndexOf('/'));
            
            // Create the directory structure if it doesn't exist
            try {
                await StorageAccessFramework.makeDirectoryAsync(baseDirectoryUri, dbDirPath);
                console.log(`Created database backup directory: ${dbDirPath}`);
            } catch (dirError) {
                console.log(`Database directory creation failed or already exists: ${dirError}`);
                // We'll continue anyway as the directory might already exist
            }
            
            // Now read and write the database file
            const dbContent = await FileSystem.readAsStringAsync(dbSourceUri, { encoding: FileSystem.EncodingType.Base64 });
            const createdDbFileUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, dbFullPathName, 'application/vnd.sqlite3');
            await FileSystem.writeAsStringAsync(createdDbFileUri, dbContent, { encoding: FileSystem.EncodingType.Base64 });
            return { statusKey: 'backupDbStatusSuccessful' };
        } else {
            return { statusKey: 'backupDbStatusSkipped' };
        }
    } catch (dbBackupError) {
        console.error('Error during database backup:', dbBackupError);
        const errorString = dbBackupError instanceof Error ? dbBackupError.message : String(dbBackupError);
        return { statusKey: 'backupDbStatusFailed', error: errorString };
    }
}

// --- Backup Helper: Unsynced Audio ---
export async function backupUnsyncedAudio(
    system: any, // Pass system explicitly
    baseDirectoryUri: string,
    audioBaseDirPath: string,
    timestamp: string
): Promise<{ count: number, errors: string[] }> {
    let filesBackedUpCount = 0;
    const copyErrors: string[] = [];
    try {
        // Use functions defined within this module
        const audioAssetMap = await getAudioAssetMap(system);
        const unsyncedIds = await getFilesInUploadQueue();

        if (unsyncedIds.length > 0) {
            // Create the audio directory if there are files to backup
            try {
                // Create the audio directory structure
                await StorageAccessFramework.makeDirectoryAsync(
                    baseDirectoryUri, 
                    audioBaseDirPath
                );
                console.log(`Created audio backup directory: ${audioBaseDirPath}`);
            } catch (dirError) {
                console.log(`Audio directory creation failed or already exists: ${dirError}`);
                // We'll continue anyway as the directory might already exist
            }
        }

        for (const [audioId, assetId] of audioAssetMap.entries()) {
            if (!audioId || !unsyncedIds.includes(audioId)) continue;

            const sourceUri = FileSystem.documentDirectory + 'attachments/' + audioId;
            const originalExtension = audioId.split('.').pop()?.toLowerCase() || 'm4a';
            // Use functions defined within this module
            const assetName = await getAssetName(system, assetId);
            const sanitizedAssetName = sanitizeAssetName(assetName);
            const backupFilenameWithAsset = `${sanitizedAssetName}_${timestamp}.${originalExtension}`;
            const audioFullPathName = `${audioBaseDirPath}/${backupFilenameWithAsset}`;

            try {
                const fileInfo = await FileSystem.getInfoAsync(sourceUri);
                if (fileInfo.exists) {
                    const fileContent = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
                    let mimeType = 'audio/mpeg';
                    if (originalExtension === 'm4a') mimeType = 'audio/aac';
                    else if (originalExtension === 'mp3') mimeType = 'audio/mpeg';
                    const createdAudioFileUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, audioFullPathName, mimeType);
                    await FileSystem.writeAsStringAsync(createdAudioFileUri, fileContent, { encoding: FileSystem.EncodingType.Base64 });
                    filesBackedUpCount++;
                }
            } catch (fileCopyError) {
                const errorString = `Failed to copy ${audioId}: ${fileCopyError instanceof Error ? fileCopyError.message : String(fileCopyError)}`;
                console.error(errorString);
                copyErrors.push(errorString);
            }
        }
    } catch (audioQueryError) {
        console.error('Error retrieving audio file list:', audioQueryError);
        // Re-throw critical errors related to getting the list itself
        throw audioQueryError;
    }
    return { count: filesBackedUpCount, errors: copyErrors };
} 