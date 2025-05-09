import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { getFilesInUploadQueue } from '@/utils/attachmentUtils';
import { Platform } from 'react-native';
import type { System } from '@/db/powersync/system'; // Import System type
import { eq } from 'drizzle-orm';

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
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (permissions.granted && permissions.directoryUri) {
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
// Simplified for audio-only backup
export function prepareBackupPaths(timestamp: string): {
  mainBackupDirName: string;
  // dbFullPathName: string; // Removed
  // audioBaseDirPath: string; // Removed, using flat structure
  // dbSourceUri: string; // Removed
} {
  const mainBackupDirName = `backup_${timestamp}`;
  // const dbFullPathName = `${mainBackupDirName}/database/sqlite.db`; // Removed
  // const audioBaseDirPath = `${mainBackupDirName}/audio_files`; // Removed
  // const dbSourceUri = (FileSystem.documentDirectory ?? '') + 'sqlite.db'; // Removed
  return { mainBackupDirName }; // Only return what might be needed (directory name)
}

// Removed unused ensureDirectoryStructure function
// async function ensureDirectoryStructure(...) { ... }

// Progress callback type
export type ProgressCallback = (progress: number, total: number) => void;

// --- Backup Helper: Unsynced Audio ---
// Function signature remains similar, but internal usage might simplify
export async function backupUnsyncedAudio(
  system: System,
  baseDirectoryUri: string,
  // _audioBaseDirPath: string, // unused for flat backup
  // _timestamp: string // unused for flat backup
  onProgress?: ProgressCallback
): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];
  try {
    const unsyncedIds = await getFilesInUploadQueue();
    const totalFiles = unsyncedIds.length;

    // Report initial progress
    onProgress?.(0, totalFiles);

    // Iterate directly over unsynced IDs found in the attachments table
    for (const [index, audioId] of unsyncedIds.entries()) {
      if (!audioId) continue; // Skip null/empty IDs just in case

      // Construct the source path based on the attachment ID
      const sourceUri = `${FileSystem.documentDirectory}shared_attachments/${audioId}`;
      try {
        const fileInfo = await FileSystem.getInfoAsync(sourceUri, {
          size: true
        });
        if (!fileInfo.exists) {
          console.warn(
            `[backupUnsyncedAudio] Source file not found: ${sourceUri}`
          );
          errors.push(`Source file not found: ${audioId}`);
          continue;
        }

        // Embed assetId and timestamp in backup filename
        let assetId: string | undefined;
        // First, check asset_content_link (for source audio)
        const contentLink = await system.db.query.asset_content_link.findFirst({
          where: (acl) => eq(acl.audio_id, audioId)
        });
        if (contentLink) {
          assetId = contentLink.asset_id;
        } else {
          // If not found, check translation table (for user recordings)
          const transLink = await system.db.query.translation.findFirst({
            where: (t) => eq(t.audio, audioId)
          });
          if (transLink) {
            assetId = transLink.asset_id;
          }
        }

        if (!assetId) {
          console.warn(
            `[backupUnsyncedAudio] No asset link found in asset_content_link OR translation for audioId: ${audioId}`
          );
          errors.push(`No asset mapping found for audioId: ${audioId}`);
          onProgress?.(index + 1, totalFiles);
          continue;
        }

        const baseAudioId = audioId.includes('.')
          ? audioId.substring(0, audioId.lastIndexOf('.'))
          : audioId;
        const extension = audioId.includes('.')
          ? audioId.split('.').pop()!
          : 'm4a';
        const timestamp = Date.now();
        const backupFileName = `${assetId}_${baseAudioId}_${timestamp}.${extension}`;
        const backupFileUri = await StorageAccessFramework.createFileAsync(
          baseDirectoryUri,
          backupFileName,
          'audio/aac'
        );
        // Read source file content as Base64 and write it under the new name
        const fileContentBase64 = await FileSystem.readAsStringAsync(
          sourceUri,
          {
            encoding: FileSystem.EncodingType.Base64
          }
        );
        await FileSystem.writeAsStringAsync(backupFileUri, fileContentBase64, {
          encoding: FileSystem.EncodingType.Base64
        });
        count++;
        onProgress?.(index + 1, totalFiles);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[backupUnsyncedAudio] Error backing up ${audioId}:`,
          error
        );
        errors.push(`Error backing up ${audioId}: ${message}`);
        // DO NOT re-throw here, just record the error for this specific file

        // Still report progress even on error
        onProgress?.(index + 1, totalFiles);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '[backupUnsyncedAudio] Critical error during audio backup preparation:',
      error
    );
    errors.push(`Critical error: ${message}`);
    // RE-THROW the critical error to be caught by the caller (handleBackup)
    throw error;
  }
  return { count, errors };
}
