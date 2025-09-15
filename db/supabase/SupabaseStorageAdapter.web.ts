import { AppConfig } from '@/db/supabase/AppConfig';
import type { StorageAdapter } from '@powersync/attachments';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseStorageAdapterOptions {
  client: SupabaseClient;
}

/**
 * Web implementation of StorageAdapter.
 *
 * - uploadFile/downloadFile delegate to Supabase Storage
 * - local file APIs are no-ops on web (no device file system)
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly encoder = new TextEncoder();

  constructor(private options: SupabaseStorageAdapterOptions) {}

  async uploadFile(
    filename: string,
    data: ArrayBuffer,
    options?: { mediaType?: string }
  ): Promise<void> {
    if (!AppConfig.supabaseBucket) {
      throw new Error('Supabase bucket not configured in AppConfig.ts');
    }
    const { mediaType = 'application/octet-stream' } = options ?? {};
    const { error } = await this.options.client.storage
      .from(AppConfig.supabaseBucket)
      .upload(filename, data, { contentType: mediaType, upsert: true });
    if (error) throw error;
  }

  async downloadFile(filePath: string) {
    if (!AppConfig.supabaseBucket) {
      throw new Error('Supabase bucket not configured in AppConfig.ts');
    }
    const { data, error } = await this.options.client.storage
      .from(AppConfig.supabaseBucket)
      .download(filePath);
    if (error) throw error;
    return data;
  }

  writeFile(
    _fileURI: string,
    _base64Data: string,
    _options?: { encoding?: 'utf8' | 'base64' }
  ): Promise<void> {
    // No-op on web
    return Promise.resolve();
  }

  readFile(
    _fileURI: string,
    _options?: { encoding?: 'utf8' | 'base64'; mediaType?: string }
  ): Promise<ArrayBuffer> | never {
    throw new Error('readFile is not supported on web');
  }

  deleteFile(_uri: string, _options?: { filename?: string }): Promise<void> {
    // No-op on web
    return Promise.resolve();
  }

  fileExists(_fileURI: string): Promise<boolean> {
    // Treat as existing to prevent download scheduling on web
    return Promise.resolve(true);
  }

  makeDir(_uri: string): Promise<void> {
    // No-op on web
    return Promise.resolve();
  }

  copyFile(_sourceUri: string, _targetUri: string): Promise<void> {
    // No-op on web
    return Promise.resolve();
  }

  getUserStorageDirectory(): string {
    // Not applicable on web
    return '';
  }

  stringToArrayBuffer(str: string) {
    const bytes = this.encoder.encode(str);
    return bytes.buffer as unknown as ArrayBuffer;
  }

  base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const bytes = this.encoder.encode(binaryString);
    return bytes.buffer as unknown as ArrayBuffer;
  }
}


