import { Directory, File as ExpoFile, Paths } from 'expo-file-system';

/**
 * Delete a file if it exists. No-ops if uri is falsy or file is missing.
 */
export function deleteIfExists(uri: string | null | undefined): void {
  try {
    if (!uri) return;
    const file = new ExpoFile(uri);
    // Using synchronous info/exists checks available in expo-file-system next
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    // Swallow errors to avoid crashing on cleanup paths
    void error;
  }
}

/**
 * Check if a file exists at the given uri.
 */
export function fileExists(uri: string | null | undefined): boolean {
  try {
    if (!uri) return false;
    const file = new ExpoFile(uri);
    return file.exists === true;
  } catch {
    return false;
  }
}

export function ensureDir(uri: string): void {
  const dir = new Directory(uri);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

export function writeFile(
  fileURI: string,
  data: string | Uint8Array,
  options?: { encoding?: 'utf8' | 'base64' }
): void {
  const { encoding = 'utf8' } = options ?? {};
  const dir = fileURI.split('/').slice(0, -1).join('/');
  ensureDir(dir);
  if (typeof data !== 'string') {
    new ExpoFile(fileURI).write(data);
    return;
  }
  if (encoding === 'base64') {
    const decoded = atob(data);
    new ExpoFile(fileURI).write(decoded);
  } else {
    new ExpoFile(fileURI).write(data);
  }
}

export async function readFile(
  fileURI: string,
  options?: { encoding?: 'utf8' | 'base64' }
): Promise<string> {
  const { encoding = 'utf8' } = options ?? {};
  const f = new ExpoFile(fileURI);
  if (!f.exists) {
    throw new Error(`File does not exist: ${fileURI}`);
  }
  if (encoding === 'base64') {
    return f.base64();
  }
  const text = await f.text();
  return text;
}

export function deleteFile(uri: string): void {
  if (fileExists(uri)) new ExpoFile(uri).delete();
}

export function copyFile(sourceUri: string, targetUri: string): void {
  new ExpoFile(sourceUri).copy(new ExpoFile(targetUri));
}

export function getDocumentDirectory(): string {
  return Paths.document.uri;
}

const encoder = new TextEncoder();
export function stringToArrayBuffer(str: string): ArrayBuffer {
  const bytes = encoder.encode(str);
  return bytes.buffer as unknown as ArrayBuffer;
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = encoder.encode(binaryString);
  return bytes.buffer as unknown as ArrayBuffer;
}
