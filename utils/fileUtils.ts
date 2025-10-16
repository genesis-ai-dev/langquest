import * as FileSystem from 'expo-file-system';

/**
 * Delete a file if it exists. No-ops if uri is falsy or file is missing.
 */
export async function deleteIfExists(uri: string | null | undefined) {
  await FileSystem.deleteAsync(uri ?? '');
}

/**
 * Check if a file exists at the given uri.
 */
export async function fileExists(uri: string | null | undefined) {
  const fileInfo = await FileSystem.getInfoAsync(uri ?? '');
  return fileInfo.exists;
}

export async function ensureDir(uri: string) {
  const directoryInfo = await FileSystem.getInfoAsync(uri);
  if (!directoryInfo.exists || !directoryInfo.isDirectory) {
    await FileSystem.makeDirectoryAsync(uri, {
      intermediates: true
    });
  }
}

export async function writeFile(
  fileURI: string,
  data: string,
  options?: { encoding?: 'utf8' | 'base64' }
) {
  const { encoding = FileSystem.EncodingType.UTF8 } = options ?? {};
  const dir = fileURI.split('/').slice(0, -1).join('/');
  await ensureDir(dir);
  if (typeof data !== 'string') {
    await FileSystem.writeAsStringAsync(fileURI, data);
    return;
  }
  await FileSystem.writeAsStringAsync(fileURI, data, { encoding });
}

export async function readFile(
  fileURI: string,
  _options?: { encoding?: 'utf8' | 'base64' }
) {
  if (!(await fileExists(fileURI))) {
    throw new Error(`File does not exist: ${fileURI}`);
  }

  // For binary files (audio, images, etc.), always read as base64
  // This prevents data corruption from UTF-8 conversion
  const fileContent = await FileSystem.readAsStringAsync(fileURI, {
    encoding: FileSystem.EncodingType.Base64
  });

  // Convert base64 to ArrayBuffer properly
  return base64ToArrayBuffer(fileContent);
}

export async function deleteFile(uri: string) {
  if (await fileExists(uri)) {
    await FileSystem.deleteAsync(uri);
  }
}

export async function copyFile(sourceUri: string, targetUri: string) {
  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
}

export function getDocumentDirectory() {
  return FileSystem.documentDirectory;
}

const encoder = new TextEncoder();

export function stringToArrayBuffer(str: string) {
  const bytes = encoder.encode(str);
  return bytes.buffer as unknown as ArrayBuffer;
}

export function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
