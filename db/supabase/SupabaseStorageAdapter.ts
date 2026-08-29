import { AppConfig } from '@/db/supabase/AppConfig';
import {
  base64ToArrayBuffer,
  copyFile,
  deleteIfExists,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  readFile,
  stringToArrayBuffer,
  writeFile
} from '@/utils/fileUtils';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseStorageAdapterOptions {
  client: SupabaseClient;
}

export class SupabaseStorageAdapter {
  private readonly encoder = new TextEncoder();

  constructor(private options: SupabaseStorageAdapterOptions) {}

  async uploadFile(
    filename: string,
    data: ArrayBuffer,
    options?: {
      mediaType?: string;
    }
  ): Promise<void> {
    if (!AppConfig.supabaseBucket) {
      throw new Error('Supabase bucket not configured in AppConfig.ts');
    }

    const { mediaType = 'text/plain' } = options ?? {};

    // upsert makes uploads idempotent: re-uploading an identical file is a
    // harmless overwrite instead of a "resource already exists" error.
    const res = await this.options.client.storage
      .from(AppConfig.supabaseBucket)
      .upload(filename, data, {
        contentType: mediaType,
        upsert: true
      });

    if (res.error) {
      console.error('[STORAGE] Upload failed:', filename, res.error);
      throw res.error;
    }
  }

  async downloadFile(filePath: string) {
    if (!AppConfig.supabaseBucket) {
      throw new Error('Supabase bucket not configured in AppConfig.ts');
    }

    const { data, error } = await this.options.client.storage
      .from(AppConfig.supabaseBucket)
      .download(filePath);
    if (error) {
      throw error;
    }

    return data;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async writeFile(
    fileURI: string,
    base64Data: string,
    options?: {
      encoding?: 'utf8' | 'base64';
    }
  ) {
    return writeFile(fileURI, base64Data, options);
  }

  async readFile(
    fileURI: string,
    options?: { encoding?: 'utf8' | 'base64'; mediaType?: string }
  ): Promise<ArrayBuffer> {
    const exists = fileExists(fileURI);

    if (!exists) {
      console.error('[STORAGE] File does not exist for upload:', fileURI);
      throw new Error(`File does not exist for upload: ${fileURI}`);
    }

    try {
      const result = await readFile(fileURI, options);
      return result;
    } catch (error) {
      console.error('[STORAGE] Error reading file for upload:', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteFile(uri: string, options?: { filename?: string }) {
    deleteIfExists(uri);

    const { filename } = options ?? {};
    if (!filename) {
      return;
    }

    // if (!AppConfig.supabaseBucket) {
    //   throw new Error('Supabase bucket not configured in AppConfig.ts');
    // }

    // const { data, error } = await this.options.client.storage
    //   .from(AppConfig.supabaseBucket)
    //   .remove([filename]);
    // if (error) {
    //   console.debug('Failed to delete file from Cloud Storage', error);
    //   throw error;
    // }

    // console.debug('Deleted file from storage', data);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async fileExists(fileURI: string): Promise<boolean> {
    return fileExists(fileURI);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async makeDir(uri: string): Promise<void> {
    ensureDir(uri);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async copyFile(sourceUri: string, targetUri: string): Promise<void> {
    copyFile(sourceUri, targetUri);
  }

  getUserStorageDirectory(): string {
    return getDocumentDirectory();
  }

  stringToArrayBuffer(str: string) {
    return stringToArrayBuffer(str);
  }

  /**
   * Converts a base64 string to an ArrayBuffer
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async base64ToArrayBuffer(base64: string) {
    return base64ToArrayBuffer(base64);
  }
}
