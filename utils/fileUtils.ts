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
    const pathWithoutProtocol = uri.replace(/^file:\/\//, ''); // Remove file:// or file:///
    // Remove any trailing slashes or path components like '/..'
    const cleanPath = pathWithoutProtocol
      .replace(/\/\.\.?\/?$/, '')
      .replace(/\/+$/, '');
    if (!cleanPath || cleanPath === '') {
      return 'file:///';
    }
    const parts = cleanPath
      .split('/')
      .filter((p) => p !== '' && p !== '.' && p !== '..');
    if (parts.length === 0) {
      return 'file:///';
    }
    const dir = '/' + parts.slice(0, -1).join('/');
    return `file://${dir}`;
  }
  // Remove any trailing slashes or path components like '/..'
  const cleanPath = uri.replace(/\/\.\.?\/?$/, '').replace(/\/+$/, '');
  const parts = cleanPath
    .split('/')
    .filter((p) => p !== '' && p !== '.' && p !== '..');
  if (parts.length === 0) {
    return '/';
  }
  return parts.slice(0, -1).join('/');
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

/**
 * Normalizes a file URI to ensure it's properly formatted and has no path traversal components
 */
export function normalizeFileUri(uri: string): string {
  let normalized = uri.trim();

  // Handle file:// URIs
  if (normalized.startsWith('file://')) {
    // Normalize to file:/// (three slashes) if needed
    if (normalized.startsWith('file:////')) {
      normalized = normalized.replace(/^file:\/\/\//, 'file:///');
    } else if (!normalized.startsWith('file:///')) {
      normalized = normalized.replace(/^file:\/\//, 'file:///');
    }

    // Remove path traversal components (/.. and /.)
    normalized = normalized.replace(/\/\.\.?(\/|$)/g, '/');

    // Remove trailing slashes (but keep file:///)
    normalized = normalized.replace(/\/+$/, '');

    // Remove double slashes in the path part (after file:///)
    normalized = normalized.replace(/file:\/\/(.+)/, (match, path) => {
      const cleanPath = path.replace(/\/+/g, '/');
      const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
      return `file://${finalPath}`;
    });
  } else {
    // Not a file:// URI - just clean up path traversal and double slashes
    normalized = normalized.replace(/\/\.\.?(\/|$)/g, '/');
    normalized = normalized.replace(/\/+$/, '');
    normalized = normalized.replace(/\/\/+/g, '/');
  }

  return normalized;
}

export async function moveFile(sourceUri: string, targetUri: string) {
  // On iOS Simulator, FileSystem.moveAsync has a bug where it appends /.. to paths
  // Workaround: Use copy + delete instead of move
  // This is more reliable across platforms and avoids the simulator bug

  // Normalize both URIs to ensure they're properly formatted
  const fromUri = normalizeFileUri(sourceUri);
  const toUri = normalizeFileUri(targetUri);

  try {
    // Try moveAsync first (faster on real devices)
    await FileSystem.moveAsync({ from: fromUri, to: toUri });
  } catch (error) {
    // If moveAsync fails (e.g., iOS Simulator bug), fall back to copy + delete
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('/..') || errorMessage.includes('not writable')) {
      console.log('⚠️ moveAsync failed, using copy + delete fallback');
      // Copy the file
      await FileSystem.copyAsync({ from: fromUri, to: toUri });
      // Delete the source file - ensure URI is normalized before deletion
      const deleteUri = normalizeFileUri(fromUri);
      try {
        await FileSystem.deleteAsync(deleteUri, { idempotent: true });
      } catch (deleteError) {
        // If deletion fails (common on iOS Simulator with temp files), log but don't fail
        // Temp files will be cleaned up automatically by the OS
        const isTempFile =
          deleteUri.includes('/tmp/') || deleteUri.includes('/tmp');
        if (isTempFile) {
          console.log(
            `⚠️ Failed to delete temp file (will be cleaned up automatically): ${deleteUri}`
          );
        } else {
          // For non-temp files, log the error but don't throw - file was already copied
          console.warn(
            `⚠️ Failed to delete source file after copy: ${deleteUri}`,
            deleteError
          );
        }
      }
    } else {
      // Re-throw if it's a different error
      throw error;
    }
  }
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

// eslint-disable-next-line @typescript-eslint/require-await
export async function getLocalAttachmentUriWithOPFS(filePath: string) {
  // no OPFS on native
  return getLocalAttachmentUri(filePath);
}

export function getLocalAttachmentUri(filePath: string) {
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
  const cleanSourceUri = normalizeFileUri(uri);

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

  const newPath = getLocalAttachmentUri(newUri);
  await ensureDir(getDirectory(newPath));

  // Debug: Log the URIs before moving
  console.log('📦 Moving file:', {
    from: cleanSourceUri,
    to: newPath,
    fromLength: cleanSourceUri.length,
    toLength: newPath.length
  });

  try {
    await moveFile(cleanSourceUri, newPath);
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('❌ moveFile error details:', {
      error,
      sourceUri: cleanSourceUri,
      targetUri: newPath,
      sourceExists: await fileExists(cleanSourceUri),
      targetExists: await fileExists(newPath)
    });
    throw error;
  }

  console.log('✅ Audio file saved locally:', getLocalAttachmentUri(newUri));
  return newUri;
}
