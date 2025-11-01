import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import type { System } from '@/db/powersync/system'; // Import System type
import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { Platform } from 'react-native';
import { getDocumentDirectory, getLocalAttachmentUriWithOPFS } from './fileUtils';
import { eq, isNotNull, inArray } from 'drizzle-orm';
import { asset_content_link, asset, quest, quest_asset_link, project } from '@/db/drizzleSchema';

// --- Permission Helper ---
export async function requestBackupDirectory() {
  // Android-specific permission handling - return null for other platforms
  if (Platform.OS !== 'android') {
    throw new Error(
      'Requesting backup directory is only supported on Android.'
    );
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
export function prepareBackupPaths(timestamp: string): {
  mainBackupDirName: string;
  dbFullPathName: string;
  publishedDirName: string;
  unpublishedDirName: string;
  csvFileName: string;
  dbSourceUri: string;
} {
  const mainBackupDirName = `backup_${timestamp}`;
  return {
    mainBackupDirName,
    dbFullPathName: `${mainBackupDirName}/database/sqlite.db`,
    publishedDirName: `${mainBackupDirName}/published`,
    unpublishedDirName: `${mainBackupDirName}/unpublished`,
    csvFileName: `${mainBackupDirName}/asset_content_export.csv`,
    dbSourceUri: (FileSystem.documentDirectory ?? '') + 'sqlite.db'
  };
}

// Removed unused ensureDirectoryStructure function
// async function ensureDirectoryStructure(...) { ... }

// Progress callback type
export type ProgressCallback = (progress: number, total: number) => void;

// Helper function to escape CSV fields
function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) return '';
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  const escaped = field.replace(/"/g, '""');
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped}"`;
  }
  return escaped;
}

// Helper function to create CSV row
function createCsvRow(
  projectName: string | null,
  questName: string | null,
  assetName: string | null,
  sourceAssetName: string | null,
  text: string | null,
  audio: string[]
): string {
  const audioValue = audio?.length > 0 ? audio.join(';') : '';
  return [
    escapeCsvField(projectName || ''),
    escapeCsvField(questName || ''),
    escapeCsvField(assetName || ''),
    escapeCsvField(sourceAssetName || ''),
    escapeCsvField(text || ''),
    escapeCsvField(audioValue)
  ].join(',');
}

// Helper to get all existing files across all backup directories recursively
// This prevents duplicates across multiple backup runs
async function getAllExistingFiles(
  baseDirectoryUri: string
): Promise<Set<string>> {
  const existingFiles = new Set<string>();
  try {
    // Read all entries in the base directory
    const entries = await StorageAccessFramework.readDirectoryAsync(baseDirectoryUri);
    
    for (const entryUri of entries) {
      try {
        const encoded = entryUri.split('/').pop()!;
        const decodedSegment = decodeURIComponent(encoded);
        const entryName = decodedSegment.includes('/')
          ? decodedSegment.substring(decodedSegment.lastIndexOf('/') + 1)
          : decodedSegment;
        
        // Check if it's a backup directory (starts with "backup_")
        if (entryName.startsWith('backup_')) {
          // Check published and unpublished subdirectories
          const publishedPath = `${baseDirectoryUri}/${entryName}/published`;
          const unpublishedPath = `${baseDirectoryUri}/${entryName}/unpublished`;
          
          try {
            const publishedFiles = await StorageAccessFramework.readDirectoryAsync(publishedPath);
            for (const fileUri of publishedFiles) {
              const fileEncoded = fileUri.split('/').pop()!;
              const fileDecoded = decodeURIComponent(fileEncoded);
              const fileName = fileDecoded.includes('/')
                ? fileDecoded.substring(fileDecoded.lastIndexOf('/') + 1)
                : fileDecoded;
              existingFiles.add(fileName);
            }
          } catch {
            // Directory might not exist, ignore
          }
          
          try {
            const unpublishedFiles = await StorageAccessFramework.readDirectoryAsync(unpublishedPath);
            for (const fileUri of unpublishedFiles) {
              const fileEncoded = fileUri.split('/').pop()!;
              const fileDecoded = decodeURIComponent(fileEncoded);
              const fileName = fileDecoded.includes('/')
                ? fileDecoded.substring(fileDecoded.lastIndexOf('/') + 1)
                : fileDecoded;
              existingFiles.add(fileName);
            }
          } catch {
            // Directory might not exist, ignore
          }
        }
      } catch (error) {
        // Skip entries that can't be read
        continue;
      }
    }
  } catch (error) {
    console.warn(`[getAllExistingFiles] Error reading directory: ${error}`);
  }
  return existingFiles;
}

// Helper to get directory URI for file creation
// StorageAccessFramework will create directories automatically when creating files with paths
function getDirectoryUri(baseUri: string, dirName: string): string {
  return `${baseUri}/${dirName}`;
}

// --- Backup Helper: Comprehensive Audio Backup ---
export async function backupUnsyncedAudio(
  system: System,
  baseDirectoryUri: string,
  onProgress?: ProgressCallback
): Promise<{ count: number; errors: string[]; csvRows: number }> {
  let count = 0;
  const errors: string[] = [];
  let csvRowCount = 0;

  try {
    // Prepare folder structure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const paths = prepareBackupPaths(timestamp);
    const publishedDirUri = getDirectoryUri(
      baseDirectoryUri,
      paths.publishedDirName
    );
    const unpublishedDirUri = getDirectoryUri(
      baseDirectoryUri,
      paths.unpublishedDirName
    );

    // Get all existing files across all backup directories to avoid duplicates
    const allExistingFiles = await getAllExistingFiles(baseDirectoryUri);

    // Query all asset_content_link records with audio
    // Include source asset information to show translation relationships
    const allContentLinks = await system.db
      .select({
        id: asset_content_link.id,
        asset_id: asset_content_link.asset_id,
        text: asset_content_link.text,
        audio: asset_content_link.audio,
        source: asset_content_link.source,
        asset_name: asset.name,
        asset_source_asset_id: asset.source_asset_id,
        quest_id: quest.id,
        quest_name: quest.name,
        project_id: project.id,
        project_name: project.name
      })
      .from(asset_content_link)
      .innerJoin(asset, eq(asset_content_link.asset_id, asset.id))
      .leftJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
      .leftJoin(quest, eq(quest_asset_link.quest_id, quest.id))
      .leftJoin(project, eq(quest.project_id, project.id))
      .where(isNotNull(asset_content_link.audio));

    // Get source asset names for translations
    const sourceAssetIds = new Set(
      allContentLinks
        .map((link) => link.asset_source_asset_id)
        .filter((id): id is string => id !== null)
    );
    
    // Create a map of source asset IDs to names
    const sourceAssetMap = new Map<string, string>();
    
    // Get all source assets properly
    if (sourceAssetIds.size > 0) {
      const assetIdsArray = Array.from(sourceAssetIds);
      const allSourceAssets = await system.db
        .select({
          id: asset.id,
          name: asset.name
        })
        .from(asset)
        .where(inArray(asset.id, assetIdsArray));
      
      for (const sourceAsset of allSourceAssets) {
        sourceAssetMap.set(sourceAsset.id, sourceAsset.name || '');
      }
    }

    // Group by content_link id to get unique records (one per asset_content_link)
    // If an asset is in multiple quests, we'll use the first one found
    const contentLinksMap = new Map<
      string,
      (typeof allContentLinks)[0]
    >();
    for (const link of allContentLinks) {
      if (!contentLinksMap.has(link.id)) {
        contentLinksMap.set(link.id, link);
      }
    }
    const uniqueContentLinks = Array.from(contentLinksMap.values());
    
    // Sort content links: by project name, then quest name, then asset name
    uniqueContentLinks.sort((a, b) => {
      // Project name (nulls last)
      const projectCompare = (a.project_name || '').localeCompare(b.project_name || '');
      if (projectCompare !== 0) return projectCompare;
      
      // Quest name (nulls last)
      const questCompare = (a.quest_name || '').localeCompare(b.quest_name || '');
      if (questCompare !== 0) return questCompare;
      
      // Asset name (nulls last)
      const assetCompare = (a.asset_name || '').localeCompare(b.asset_name || '');
      if (assetCompare !== 0) return assetCompare;
      
      // Finally by asset ID for consistent ordering
      return a.asset_id.localeCompare(b.asset_id);
    });

    const totalFiles = uniqueContentLinks.reduce(
      (sum, link) => sum + (link.audio?.length || 0),
      0
    );
    const totalSteps = totalFiles + uniqueContentLinks.length; // Files + CSV rows

    onProgress?.(0, totalSteps);

    // Prepare CSV data
    const csvRows: string[] = [];
    csvRows.push('Project Name,Quest Name,Asset Name,Source Asset Name,Text,Audio Files');

    let currentStep = 0;

    // Process each content link
    for (const contentLink of uniqueContentLinks) {
      const audioFiles = contentLink.audio || [];
      const isLocal = contentLink.source === 'local';
      
      // Get source asset name if this is a translation
      const sourceAssetName = contentLink.asset_source_asset_id
        ? sourceAssetMap.get(contentLink.asset_source_asset_id) || null
        : null;

      // Clean audio filenames for CSV (remove "local/" prefix to match backup filenames)
      const cleanedAudioFiles = audioFiles.map((audioId) =>
        audioId.startsWith('local/') ? audioId.replace('local/', '') : audioId
      );

      // Add CSV row
      csvRows.push(
        createCsvRow(
          contentLink.project_name,
          contentLink.quest_name,
          contentLink.asset_name,
          sourceAssetName,
          contentLink.text,
          cleanedAudioFiles
        )
      );
      csvRowCount++;
      currentStep++;
      onProgress?.(currentStep, totalSteps);

      // Process each audio file
      for (const audioId of audioFiles) {
        if (!audioId) continue;

        // Determine if file is local (has "local/" prefix) or synced
        const isLocalFile = audioId.startsWith('local/');
        const cleanAudioId = isLocalFile ? audioId.replace('local/', '') : audioId;
        
        // Determine target folder
        const targetFolder = isLocal || isLocalFile ? unpublishedDirUri : publishedDirUri;

        // Construct source path
        let sourceUri: string;
        if (isLocalFile) {
          // Local file: use getLocalAttachmentUriWithOPFS helper
          sourceUri = getLocalAttachmentUriWithOPFS(audioId);
        } else {
          // Synced file: directly in shared_attachments
          sourceUri = `${getDocumentDirectory()}${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${cleanAudioId}`;
        }

        try {
          const fileInfo = await FileSystem.getInfoAsync(sourceUri, {
            size: true
          });
          if (!fileInfo.exists) {
            console.warn(
              `[backupUnsyncedAudio] Source file not found: ${sourceUri}`
            );
            errors.push(`Source file not found: ${audioId}`);
            currentStep++;
            onProgress?.(currentStep, totalSteps);
            continue;
          }

          // Use the original audio filename (cleaned of "local/" prefix)
          // This matches what's in the CSV, so users can find files directly
          const backupFileName = cleanAudioId;
          
          // Determine extension for mime type
          const extension = cleanAudioId.includes('.')
            ? cleanAudioId.split('.').pop()!
            : 'm4a';

          // Check if file already exists in any backup directory
          if (allExistingFiles.has(backupFileName)) {
            console.log(
              `[backupUnsyncedAudio] File ${backupFileName} already exists in a previous backup. Skipping.`
            );
            currentStep++;
            onProgress?.(currentStep, totalSteps);
            continue;
          }

          // Use proper mime type
          const mimeType = extension === 'm4a' ? 'audio/mp4' : 'audio/aac';

          // Create file in target folder
          const backupFileUri = await StorageAccessFramework.createFileAsync(
            targetFolder,
            backupFileName,
            mimeType
          );

          // Read and write file
          const fileContentBase64 = await FileSystem.readAsStringAsync(
            sourceUri,
            {
              encoding: FileSystem.EncodingType.Base64
            }
          );
          await FileSystem.writeAsStringAsync(backupFileUri, fileContentBase64, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          // Track in existing files set to prevent duplicates
          allExistingFiles.add(backupFileName);
          count++;
          currentStep++;
          onProgress?.(currentStep, totalSteps);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `[backupUnsyncedAudio] Error backing up ${audioId}:`,
            error
          );
          errors.push(`Error backing up ${audioId}: ${message}`);
          currentStep++;
          onProgress?.(currentStep, totalSteps);
        }
      }
    }

    // Write CSV file - check for existing CSV and append only new rows
    try {
      // Check if CSV already exists by looking for any CSV file in backup directories
      let existingCsvRows: Set<string> = new Set();
      try {
        const entries = await StorageAccessFramework.readDirectoryAsync(baseDirectoryUri);
        for (const entryUri of entries) {
          try {
            const encoded = entryUri.split('/').pop()!;
            const decodedSegment = decodeURIComponent(encoded);
            const entryName = decodedSegment.includes('/')
              ? decodedSegment.substring(decodedSegment.lastIndexOf('/') + 1)
              : decodedSegment;
            
            // Check if it's a backup directory
            if (entryName.startsWith('backup_')) {
              // Look for CSV file inside this backup directory
              const csvFileName = `${entryName}/asset_content_export.csv`;
              try {
                const csvPath = `${baseDirectoryUri}/${csvFileName}`;
                const csvContent = await FileSystem.readAsStringAsync(csvPath, {
                  encoding: FileSystem.EncodingType.UTF8
                });
                // Parse CSV and collect all data rows (skip header)
                const lines = csvContent.split('\n');
                for (let i = 1; i < lines.length; i++) {
                  const line = lines[i]?.trim();
                  if (line) {
                    existingCsvRows.add(line);
                  }
                }
              } catch {
                // Skip if can't read CSV
              }
            }
          } catch {
            // Skip entries that can't be processed
            continue;
          }
        }
      } catch {
        // If we can't check for existing CSV, proceed with new file
      }
      
      // Filter out rows that already exist
      const newRows = csvRows.filter((row, index) => {
        if (index === 0) return true; // Always include header
        return !existingCsvRows.has(row);
      });
      
      const csvContent = newRows.join('\n');
      const csvUri = await StorageAccessFramework.createFileAsync(
        baseDirectoryUri,
        paths.csvFileName,
        'text/csv'
      );
      await FileSystem.writeAsStringAsync(csvUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });
      console.log(`[backupUnsyncedAudio] CSV exported with ${newRows.length} rows (${newRows.length - 1} new data rows)`);
      csvRowCount = newRows.length - 1; // Subtract header row
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[backupUnsyncedAudio] Error creating CSV:', error);
      errors.push(`Error creating CSV: ${message}`);
    }

    // Backup database if it exists
    try {
      const dbSourceUri = paths.dbSourceUri;
      const dbInfo = await FileSystem.getInfoAsync(dbSourceUri);
      if (dbInfo.exists) {
        const dbBackupUri = await StorageAccessFramework.createFileAsync(
          baseDirectoryUri,
          paths.dbFullPathName,
          'application/x-sqlite3'
        );
        const dbContent = await FileSystem.readAsStringAsync(dbSourceUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        await FileSystem.writeAsStringAsync(dbBackupUri, dbContent, {
          encoding: FileSystem.EncodingType.Base64
        });
        console.log('[backupUnsyncedAudio] Database backed up successfully');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[backupUnsyncedAudio] Error backing up database:', error);
      errors.push(`Error backing up database: ${message}`);
    }

    return { count, errors, csvRows: csvRowCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '[backupUnsyncedAudio] Critical error during audio backup preparation:',
      error
    );
    errors.push(`Critical error: ${message}`);
    throw error;
  }
}
