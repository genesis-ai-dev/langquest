import type { System } from '@/db/powersync/system'; // Import System type
import { getFilesInUploadQueue } from '@/utils/attachmentUtils';
import { pickDirectory } from '@react-native-documents/picker';
import { eq } from 'drizzle-orm';
import { Directory, File as ExpoFile, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// --- Permission Helper ---
export async function requestBackupDirectory(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  // iOS: ask user to pick a directory
  try {
    const { uri } = await pickDirectory({
      requestLongTermAccess: false
    });
    // Validate the uri is a non-empty string
    if (uri && uri.length > 0) {
      return uri;
    }
    // Treat empty selection as cancel
    return null;
  } catch (e) {
    const message =
      e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
    // Swallow user-cancel errors; surface anything else
    if (message.includes('cancel')) return null;
    if (message.includes('operation was cancelled')) return null;
    throw e;
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
): Promise<{ copied: number; alreadyExists: number; errors: string[] }> {
  if (Platform.OS === 'web') {
    return { copied: 0, alreadyExists: 0, errors: [] };
  }
  let copied = 0;
  let alreadyExists = 0;
  const errors: string[] = [];
  try {
    const unsyncedIds = await getFilesInUploadQueue();
    const totalFiles = unsyncedIds.length;

    // Report initial progress
    onProgress?.(0, totalFiles);

    // Get existing files in the backup directory to avoid duplicates
    const targetDir = new Directory(baseDirectoryUri);
    const existingItems = targetDir.list();
    const existingFileNames = new Set(
      existingItems
        .filter((item): item is File => item instanceof File)
        .map((f) => f.name)
    );

    // Iterate directly over unsynced IDs found in the attachments table
    for (const [index, audioId] of unsyncedIds.entries()) {
      if (!audioId) continue; // Skip null/empty IDs just in case

      // Construct the source path based on the attachment ID
      const sourceUri = new ExpoFile(
        Paths.document.uri,
        'shared_attachments',
        audioId
      ).uri;
      console.log(sourceUri, 'sourceUri');
      try {
        const fileInfo = new ExpoFile(sourceUri).info();
        if (!fileInfo.exists) {
          console.warn(
            `[backupUnsyncedAudio] Source file not found: ${sourceUri}`
          );
          errors.push(`Source file not found: ${audioId}`);
          continue;
        }

        // Embed assetId in backup filename
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

        // Remove timestamp, just use assetId_baseAudioId.extension
        const backupFileName = `${assetId}_${baseAudioId}.${extension}`;

        // Check if file already exists in backup directory
        if (existingFileNames.has(backupFileName)) {
          console.log(
            `[backupUnsyncedAudio] File ${backupFileName} already exists in backup. Skipping.`
          );
          alreadyExists++;
          onProgress?.(index + 1, totalFiles);
          continue;
        }

        const backupFile = new ExpoFile(baseDirectoryUri, backupFileName);
        backupFile.create();
        console.log('backupFile', backupFile.uri);
        const fileBytes = await new ExpoFile(sourceUri).bytes();
        backupFile.write(fileBytes);
        copied++;
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
  return { copied, alreadyExists, errors };
}
