import { system } from '@/db/powersync/system';
import { AttachmentState } from '@powersync/attachments';

export function getLocalUriFromAssetId(assetId: string) {
  return system.attachmentQueue?.getLocalUri(
    system.attachmentQueue?.getLocalFilePathSuffix(assetId)
  );
}

/**
 * Get files that are still in the upload queue (not yet synced)
 * @returns Promise resolving to array of file IDs that need to be synced
 */
export async function getFilesInUploadQueue(): Promise<string[]> {
  if (!system.powersync || !system.attachmentQueue) {
    return [];
  }
  
  try {
    // Get files that are in QUEUED_UPLOAD state (pending sync)
    const result = await system.powersync.execute(
      'SELECT id FROM attachments WHERE state = ?',
      [String(AttachmentState.QUEUED_UPLOAD)]
    );
    
    const files = [];
    // Add null check for rows
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        // Add null check for item before accessing id
        const item = result.rows.item(i);
        if (item?.id) {
          files.push(item.id);
        }
      }
    }
    return files;
  } catch (error) {
    console.error('Error checking upload queue:', error);
    return [];
  }
}

/**
 * Check if all files have been synced
 * @returns Promise resolving to boolean indicating if all files are synced
 */
export async function areAllFilesSynced(): Promise<boolean> {
  const filesInQueue = await getFilesInUploadQueue();
  return filesInQueue.length === 0;
}

/**
 * Checks if a file has been synced to the cloud
 * @param fileId The ID of the file to check
 * @returns Promise resolving to a boolean indicating sync status
 */
export async function isFileSynced(fileId: string): Promise<boolean> {
  if (!system.powersync || !system.attachmentQueue) {
    return false;
  }
  
  try {
    // Query the PowerSync attachment table
    const result = await system.powersync.execute(
      'SELECT state FROM attachments WHERE id = ?',
      [fileId]
    );
    
    // Add null check for rows
    if (!result.rows || result.rows.length === 0) {
      return false; // File not found in attachments table
    }
    
    const item = result.rows.item(0);
    const state = item?.state;
    // File is synced if state is SYNCED
    return state === AttachmentState.SYNCED;
  } catch (error) {
    console.error('Error checking file sync status:', error);
    return false;
  }
}

/**
 * Gets all files with their sync status
 * @returns Promise resolving to an array of {id, state} objects
 */
export async function getAllFilesSyncStatus(): Promise<Array<{id: string, synced: boolean}>> {
  if (!system.powersync || !system.attachmentQueue) {
    return [];
  }
  
  try {
    // Correct execute call signature
    const result = await system.powersync.execute(
      'SELECT id, state FROM attachments'
    );
    
    const files = [];
    // Add null check for rows
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        const item = result.rows.item(i);
        if (item?.id) { // Ensure item and id exist
          files.push({
            id: item.id,
            // File is synced if state is SYNCED
            synced: item.state === AttachmentState.SYNCED
          });
        }
      }
    }
    
    return files;
  } catch (error) {
    console.error('Error getting files sync status:', error);
    return [];
  }
}
