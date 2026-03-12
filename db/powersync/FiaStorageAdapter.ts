import {
  copyFile,
  deleteIfExists,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  readFile,
  writeFile
} from '@/utils/fileUtils';
import type { StorageAdapter } from '@powersync/attachments';

/**
 * Minimal StorageAdapter for the FIA attachment queue.
 * Handles local file operations against the fia_cache directory.
 * Remote downloads are handled by FiaAttachmentQueue.downloadRecord override.
 */
export class FiaStorageAdapter implements StorageAdapter {
  async uploadFile(): Promise<void> {
    // FIA content is read-only
  }

  async downloadFile(): Promise<Blob> {
    throw new Error(
      'FiaStorageAdapter.downloadFile should not be called — FiaAttachmentQueue overrides downloadRecord'
    );
  }

  async writeFile(
    fileURI: string,
    base64Data: string,
    options?: { encoding?: 'utf8' | 'base64' }
  ): Promise<void> {
    await writeFile(fileURI, base64Data, options);
  }

  async readFile(fileURI: string): Promise<ArrayBuffer> {
    return await readFile(fileURI);
  }

  async deleteFile(uri: string): Promise<void> {
    await deleteIfExists(uri);
  }

  async fileExists(fileURI: string): Promise<boolean> {
    return await fileExists(fileURI);
  }

  async makeDir(uri: string): Promise<void> {
    await ensureDir(uri);
  }

  async copyFile(sourceUri: string, targetUri: string): Promise<void> {
    await copyFile(sourceUri, targetUri);
  }

  getUserStorageDirectory(): string {
    const dir = getDocumentDirectory();
    if (!dir) return '';
    return dir.endsWith('/') ? dir : `${dir}/`;
  }
}
