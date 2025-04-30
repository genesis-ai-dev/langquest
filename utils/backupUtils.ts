import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { getFilesInUploadQueue } from '@/utils/attachmentUtils';
import { translation as translationSchema, asset_content_link as assetContentLinkSchema, asset as assetSchema } from '@/db/drizzleSchema';
import { isNotNull, eq } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// 
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
    console.warn('Requesting backup directory is only supported on Android.');
    return null;
  }

  try {
    // Always request new permissions from the user
    console.log('Requesting directory permissions from user...');
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    
    if (permissions?.granted && permissions.directoryUri) {
      console.log('Directory permission granted:', permissions.directoryUri);
      // We DO NOT save this to AsyncStorage anymore.
      // The user will be prompted each time.
      return permissions.directoryUri;
    } else {
      console.log('Directory permission denied or URI missing.');
      return null; // Permission denied or URI missing
    }
  } catch (dirError) {
    console.error('Error during directory permission request:', dirError);
    // Optionally, inform the user with an Alert here
    // Alert.alert('Error', 'Failed to get directory permissions.');
    throw dirError; // Re-throw to be handled by the caller (e.g., backup/restore function)
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

async function ensureDirectoryStructure(baseUri: string, segments: string[]): Promise<string> {
    console.log(`[ensureDirectoryStructure] Base URI: ${baseUri}, Segments: ${segments.join('/')}`);
    let currentUri = baseUri;
    for (const segment of segments) {
        console.log(`[ensureDirectoryStructure] Ensuring segment: ${segment} under URI: ${currentUri}`);
        try {
            const newUri = await StorageAccessFramework.makeDirectoryAsync(currentUri, segment);
            console.log(`[ensureDirectoryStructure] Created directory for segment ${segment}: ${newUri}`);
            currentUri = newUri;
        } catch (e: any) {
            console.warn(`[ensureDirectoryStructure] makeDirectoryAsync failed for segment ${segment} (may already exist):`, e.message || e);
            try {
                const children = await StorageAccessFramework.readDirectoryAsync(currentUri);
                console.log(`[ensureDirectoryStructure] Children of ${currentUri}: ${children.join(', ')}`);
                const foundUri = children.find(uri => {
                    const decodedChildName = decodeURIComponent(uri.split('/').pop()!);
                    console.log(`[ensureDirectoryStructure] Comparing segment '${segment}' with decoded child '${decodedChildName}' from URI '${uri}'`);
                    return decodedChildName === segment;
                });
                if (!foundUri) {
                    console.error(`[ensureDirectoryStructure] Directory ${segment} not found among children after makeDirectoryAsync failed.`);
                    throw new Error(`Failed to create or find directory segment: ${segment}`);
                }
                console.log(`[ensureDirectoryStructure] Found existing directory for segment ${segment}: ${foundUri}`);
                currentUri = foundUri;
            } catch (readError: any) {
                console.error(`[ensureDirectoryStructure] Error reading directory ${currentUri} after makeDirectoryAsync failed for ${segment}:`, readError.message || readError);
                throw readError; // Re-throw the error that occurred during the check
            }
        }
    }
    console.log(`[ensureDirectoryStructure] Final URI after ensuring segments: ${currentUri}`);
    return currentUri;
}

// --- Backup Helper: Database ---
export async function backupDatabase(
    baseDirectoryUri: string,
    _dbFullPathName: string, // unused for flat backup
    dbSourceUri: string,
    backupOnlyAudio: boolean = false
): Promise<{ statusKey: 'backupDbStatusSkipped' | 'backupDbStatusSuccessful' | 'backupDbStatusFailed'; error?: string }> {
    if (backupOnlyAudio) {
        console.log('[backupDatabase] Skipping database backup (audio-only mode)');
        return { statusKey: 'backupDbStatusSkipped' };
    }
    
    console.log('[backupDatabase] Starting flat DB backup...');
    try {
        // Check source database file
        const dbFileInfo = await FileSystem.getInfoAsync(dbSourceUri, { size: true });
        console.log(`[backupDatabase] Source DB info: exists=${dbFileInfo.exists}, uri=${dbFileInfo.uri}`);
        if (!dbFileInfo.exists) {
            console.warn('[backupDatabase] No source DB file found, skipping.');
            return { statusKey: 'backupDbStatusSkipped' };
        }
        // Read DB content
        console.log('[backupDatabase] Reading source DB content...');
        const dbContent = await FileSystem.readAsStringAsync(dbSourceUri, { encoding: FileSystem.EncodingType.Base64 });
        // Create backup file flat in selected directory
        const backupDbFileName = 'sqlite.db';
        console.log(`[backupDatabase] Creating backup DB file '${backupDbFileName}' in ${baseDirectoryUri}`);
        const backupDbUri = await StorageAccessFramework.createFileAsync(
            baseDirectoryUri,
            backupDbFileName,
            'application/vnd.sqlite3'
        );
        console.log(`[backupDatabase] Writing DB content to ${backupDbUri}`);
        await FileSystem.writeAsStringAsync(backupDbUri, dbContent, { encoding: FileSystem.EncodingType.Base64 });
        console.log('[backupDatabase] DB backup successful.');
        return { statusKey: 'backupDbStatusSuccessful' };
    } catch (error: any) {
        console.error('[backupDatabase] Error during DB backup:', error);
        return { statusKey: 'backupDbStatusFailed', error: error instanceof Error ? error.message : String(error) };
    }
}

// --- Backup Helper: Unsynced Audio ---
export async function backupUnsyncedAudio(
    system: any,
    baseDirectoryUri: string,
    _audioBaseDirPath: string, // unused for flat backup
    _timestamp: string // unused for flat backup
): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    console.log('[backupUnsyncedAudio] Starting flat audio backup...');
    try {
        const audioAssetMap = await getAudioAssetMap(system);
        const unsyncedIds = await getFilesInUploadQueue();
        const entriesToBackup = Array.from(audioAssetMap.entries()).filter(
            ([audioId]) => audioId && unsyncedIds.includes(audioId)
        );
        console.log(`[backupUnsyncedAudio] ${entriesToBackup.length} unsynced audio files to back up.`);
        for (const [audioId] of entriesToBackup) {
            const sourceUri = FileSystem.documentDirectory + 'attachments/' + audioId;
            try {
                const fileInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
                if (!fileInfo.exists) {
                    console.warn(`[backupUnsyncedAudio] Source file not found: ${sourceUri}`);
                    continue;
                }
                console.log(`[backupUnsyncedAudio] Reading ${audioId}...`);
                const content = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
                // Determine mime type
                const ext = audioId.split('.').pop()?.toLowerCase() || '';
                let mimeType = 'application/octet-stream';
                if (ext === 'm4a') mimeType = 'audio/aac';
                else if (ext === 'mp3') mimeType = 'audio/mpeg';
                console.log(`[backupUnsyncedAudio] Creating backup file '${audioId}' in ${baseDirectoryUri}`);
                const destUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, audioId, mimeType);
                await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.Base64 });
                console.log(`[backupUnsyncedAudio] ${audioId} backed up.`);
                count++;
            } catch (err: any) {
                const msg = `Failed to back up ${audioId}: ${err.message || err}`;
                console.error(`[backupUnsyncedAudio] ${msg}`);
                errors.push(msg);
            }
        }
        console.log(`[backupUnsyncedAudio] Completed audio backup. Count=${count}, Errors=${errors.length}`);
        return { count, errors };
    } catch (err: any) {
        console.error('[backupUnsyncedAudio] Error setting up audio backup:', err);
        throw err;
    }
} 