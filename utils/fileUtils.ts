import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import * as FileSystem from 'expo-file-system';

/**
 * Delete a file if it exists. No-ops if uri is falsy or file is missing.
 */
export async function deleteIfExists(uri: string | null | undefined) {
  await FileSystem.deleteAsync(uri ?? '');
}

export async function getFileInfo(uri: string | null | undefined) {
  return await FileSystem.getInfoAsync(uri ?? '');
}

/**
 * Check if a file exists at the given uri.
 */
export async function fileExists(uri: string | null | undefined) {
  const fileInfo = await getFileInfo(uri);
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
  await FileSystem.writeAsStringAsync(fileURI, data, { encoding });
}

export async function moveFile(sourceUri: string, targetUri: string) {
  await FileSystem.moveAsync({ from: sourceUri, to: targetUri });
}

export async function readFile(
  fileURI: string,
  options?: { encoding?: 'utf8' | 'base64' }
) {
  if (await fileExists(fileURI)) {
    throw new Error(`File does not exist: ${fileURI}`);
  }
  const { encoding = FileSystem.EncodingType.UTF8 } = options ?? {};

  const fileContent = await FileSystem.readAsStringAsync(fileURI, options);
  if (encoding === FileSystem.EncodingType.Base64) {
    return base64ToArrayBuffer(fileContent);
  }
  return stringToArrayBuffer(fileContent);
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
  const bytes = encoder.encode(binaryString);
  return bytes.buffer as unknown as ArrayBuffer;
}

export function getLocalUri(filePath: string) {
  return `${getDocumentDirectory()}${filePath}`;
}

export function getLocalFilePathSuffix(filename: string): string {
  return `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${filename}`;
}

// Async because it may need to fetch the file from the web
// eslint-disable-next-line @typescript-eslint/require-await
export async function getLocalAttachmentUri(filePath: string) {
  return getLocalUri(getLocalFilePathSuffix(filePath));
}

export async function saveAudioFileLocally(uri: string) {
  const newUri = getLocalUri(
    getLocalFilePathSuffix(`local/${uri.split('/').pop()}`)
  );
  if (await fileExists(uri)) {
    await moveFile(uri, newUri);
  } else {
    throw new Error(`File does not exist: ${uri}`);
  }
  return newUri;
}
