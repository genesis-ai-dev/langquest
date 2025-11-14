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
  // Handle file:// URIs properly
  // file:///path/to/file.txt -> file:///path/to
  // /path/to/file.txt -> /path/to
  if (uri.startsWith('file://')) {
    const pathWithoutProtocol = uri.replace('file://', '');
    // Remove any trailing slashes or path components like '/..'
    const cleanPath = pathWithoutProtocol.replace(/\/\.\.?\/?$/, '').replace(/\/+$/, '');
    const dir = cleanPath.split('/').slice(0, -1).join('/');
    return `file://${dir}`;
  }
  // Remove any trailing slashes or path components like '/..'
  const cleanPath = uri.replace(/\/\.\.?\/?$/, '').replace(/\/+$/, '');
  return cleanPath.split('/').slice(0, -1).join('/');
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
  // Reject blob URLs - they must be converted to files first
  if (uri.includes('blob:')) {
    throw new Error(
      `Invalid URI: blob URLs cannot be saved directly. URI: ${uri.substring(0, 100)}`
    );
  }

  // Normalize the source URI - remove any path traversal components and trailing slashes
  // Handle both file:// URIs and regular paths
  let cleanSourceUri = uri.trim();
  
  // CRITICAL: Ensure file:// URIs have exactly 3 slashes (file:///)
  // iOS returns file:///Users/... (correct), but we need to preserve this
  if (cleanSourceUri.startsWith('file://')) {
    // Normalize to file:/// (three slashes) if it's file:// (two slashes)
    if (cleanSourceUri.startsWith('file:///')) {
      // Already correct - file:///Users/...
      // Remove any trailing /.. or /. components from the path part only
      cleanSourceUri = cleanSourceUri.replace(/\/\.\.?(\/|$)/g, '/');
    } else {
      // file://Users/... -> file:///Users/...
      cleanSourceUri = cleanSourceUri.replace(/^file:\/\//, 'file:///');
      // Remove any trailing /.. or /. components
      cleanSourceUri = cleanSourceUri.replace(/\/\.\.?(\/|$)/g, '/');
    }
    
    // Remove any trailing slashes (but keep file:///)
    cleanSourceUri = cleanSourceUri.replace(/\/+$/, '');
    
    // Remove any double slashes in the path part (after file:///)
    // This handles cases like file:///Users//path -> file:///Users/path
    cleanSourceUri = cleanSourceUri.replace(/file:\/\/(.+)/, (match, path) => {
      return `file:///${path.replace(/\/+/g, '/')}`;
    });
  } else {
    // Not a file:// URI - just clean up path traversal and double slashes
    cleanSourceUri = cleanSourceUri.replace(/\/\.\.?(\/|$)/g, '/');
    cleanSourceUri = cleanSourceUri.replace(/\/+$/, '');
    cleanSourceUri = cleanSourceUri.replace(/\/\/+/g, '/');
  }
  
  // Extract extension before further processing
  const extension = cleanSourceUri.split('.').pop() || 'wav';
  
  const newUri = `local/${uuid.v4()}.${extension}`;
  console.log('🔍 Saving audio file locally:', cleanSourceUri, newUri);
  
  // Retry logic for file existence - iOS Simulator can have timing issues
  // where the file isn't immediately available after Swift writes it
  const maxRetries = 5;
  const retryDelayMs = 100;
  let fileExistsNow = false;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    fileExistsNow = await fileExists(cleanSourceUri);
    if (fileExistsNow) {
      break;
    }
    
    if (attempt < maxRetries - 1) {
      console.log(
        `⏳ File not found yet (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  
  if (!fileExistsNow) {
    // Get file info for better error message
    const fileInfo = await getFileInfo(cleanSourceUri);
    const errorMsg = `File does not exist after ${maxRetries} attempts: ${cleanSourceUri}. File info: ${JSON.stringify(fileInfo)}`;
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  const newPath = getLocalUri(getLocalFilePathSuffix(newUri));
  await ensureDir(getDirectory(newPath));
  await moveFile(cleanSourceUri, newPath);
  console.log(
    '✅ Audio file saved locally:',
    `${getLocalUri(getLocalFilePathSuffix('local'))}/${newUri}`
  );
  return newUri;
}
