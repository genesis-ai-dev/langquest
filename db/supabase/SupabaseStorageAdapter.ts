import { AppConfig } from '@/db/supabase/AppConfig';
import type { StorageAdapter } from '@powersync/attachments';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Directory, File, Paths } from 'expo-file-system';

export interface SupabaseStorageAdapterOptions {
  client: SupabaseClient;
}

export class SupabaseStorageAdapter implements StorageAdapter {
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

    const res = await this.options.client.storage
      .from(AppConfig.supabaseBucket)
      .upload(filename, data, { contentType: mediaType });

    if (res.error) {
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

  writeFile(
    fileURI: string,
    base64Data: string,
    options?: {
      encoding?: 'utf8' | 'base64';
    }
  ): Promise<void> {
    const { encoding = 'utf8' } = options ?? {};
    const dir = fileURI.split('/').slice(0, -1).join('/');
    new Directory(dir).create({ intermediates: true, idempotent: true });
    if (encoding === 'base64') {
      const decodedBytes = atob(base64Data);
      new File(fileURI).write(decodedBytes);
    } else {
      new File(fileURI).write(base64Data);
    }
    return Promise.resolve();
  }

  async readFile(
    fileURI: string,
    options?: { encoding?: 'utf8' | 'base64'; mediaType?: string }
  ): Promise<ArrayBuffer> {
    const { encoding = 'utf8' } = options ?? {};
    const f = new File(fileURI);
    if (!f.exists) {
      throw new Error(`File does not exist: ${fileURI}`);
    }
    if (encoding === 'base64') {
      const b64 = f.base64();
      return this.base64ToArrayBuffer(b64);
    }
    const text = await f.text();
    return this.stringToArrayBuffer(text);
  }

  async deleteFile(
    uri: string,
    options?: { filename?: string }
  ): Promise<void> {
    if (await this.fileExists(uri)) {
      new File(uri).delete();
    }

    const { filename } = options ?? {};
    if (!filename) {
      return;
    }

    if (!AppConfig.supabaseBucket) {
      throw new Error('Supabase bucket not configured in AppConfig.ts');
    }

    // const { data, error } = await this.options.client.storage
    //   .from(AppConfig.supabaseBucket)
    //   .remove([filename]);
    // if (error) {
    //   console.debug('Failed to delete file from Cloud Storage', error);
    //   throw error;
    // }

    // console.debug('Deleted file from storage', data);
  }

  fileExists(fileURI: string): Promise<boolean> {
    const f = new File(fileURI);
    return Promise.resolve(f.exists);
  }

  makeDir(uri: string): Promise<void> {
    const d = new Directory(uri);
    if (!d.exists) {
      d.create({ intermediates: true, idempotent: true });
    }
    return Promise.resolve();
  }

  copyFile(sourceUri: string, targetUri: string) {
    new File(sourceUri).copy(new File(targetUri));
    return Promise.resolve();
  }

  getUserStorageDirectory(): string {
    return Paths.document.uri;
  }

  stringToArrayBuffer(str: string) {
    const bytes = this.encoder.encode(str);
    return bytes.buffer as unknown as ArrayBuffer;
  }

  /**
   * Converts a base64 string to an ArrayBuffer
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const bytes = this.encoder.encode(binaryString);
    return bytes.buffer as unknown as ArrayBuffer;
  }
}
