import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';

/**
 * Extracts the filename from a URI path.
 * @param uri - The file URI or path string
 * @returns The filename (last segment after the final '/'), or undefined if the URI is empty
 * @example
 * getFileName('/path/to/file.txt') // returns 'file.txt'
 * getFileName('file.txt') // returns 'file.txt'
 */
export function getFileName(uri: string) {
  return uri.split('/').pop();
}

export function getDirectory(uri: string) {
  return uri.split('/').slice(0, -1).join('/');
}

/**
 * Delete a file if it exists. No-ops if uri is falsy or file is missing.
 */
export async function deleteIfExists(uri: string | null | undefined) {
  await FileSystem.deleteAsync(uri ?? '', { idempotent: true });
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
  base64Data: string,
  options?: { encoding?: 'utf8' | 'base64' }
) {
  const { encoding = FileSystem.EncodingType.UTF8 } = options ?? {};
  const dir = getDirectory(fileURI);
  await ensureDir(dir);
  await FileSystem.writeAsStringAsync(fileURI, base64Data, { encoding });
}

export async function moveFile(sourceUri: string, targetUri: string) {
  await FileSystem.moveAsync({ from: sourceUri, to: targetUri });
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
  return encoder.encode(str).buffer as unknown as ArrayBuffer;
}

export function base64ToArrayBuffer(base64: string) {
  return decodeBase64(base64);
}

export function getLocalUri(filePath: string) {
  return `${getDocumentDirectory()}${filePath}`;
}

export function getLocalFilePathSuffix(filename: string): string {
  return `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${filename}`;
}

export function getLocalAttachmentUriWithOPFS(filePath: string) {
  return getLocalUri(getLocalFilePathSuffix(filePath));
}

export async function saveAudioLocally(uri: string) {
  const newUri = `local/${uuid.v4()}.${uri.split('.').pop()}`;
  console.log('🔍 Saving audio file locally:', uri, newUri);
  if (await fileExists(uri)) {
    const newPath = getLocalUri(getLocalFilePathSuffix(newUri));
    await ensureDir(getDirectory(newPath));
    await moveFile(uri, newPath);
    console.log(
      '🔍 Audio file saved locally:',
      `${getLocalUri(getLocalFilePathSuffix('local'))}/${newUri}`
    );
  } else {
    throw new Error(`File does not exist: ${uri}`);
  }
  return newUri;
}
