import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Directory, File, Paths } from 'expo-file-system';
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
export function deleteIfExists(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Idempotent - ignore errors (file may not exist or be a directory)
    try {
      const dir = new Directory(uri);
      if (dir.exists) {
        dir.delete();
      }
    } catch {
      // Silently ignore
    }
  }
}

export function getFileInfo(uri: string | null | undefined) {
  if (!uri)
    return { exists: false as const, size: undefined, isDirectory: false };
  try {
    const file = new File(uri);
    if (file.exists) {
      return {
        exists: true as const,
        size: file.size ?? undefined,
        isDirectory: false,
        uri
      };
    }
    const dir = new Directory(uri);
    if (dir.exists) {
      return {
        exists: true as const,
        size: dir.size ?? undefined,
        isDirectory: true,
        uri
      };
    }
    return { exists: false as const, size: undefined, isDirectory: false, uri };
  } catch {
    return { exists: false as const, size: undefined, isDirectory: false, uri };
  }
}

/**
 * Check if a file exists at the given uri.
 */
export function fileExists(uri: string | null | undefined): boolean {
  if (!uri) return false;
  try {
    const file = new File(uri);
    return file.exists;
  } catch {
    return false;
  }
}

export function ensureDir(uri: string) {
  const dir = new Directory(uri);
  if (!dir.exists) {
    dir.create();
  }
}

export function writeFile(
  fileURI: string,
  data: string,
  options?: { encoding?: 'utf8' | 'base64' }
) {
  const { encoding = 'utf8' } = options ?? {};
  const dir = getDirectory(fileURI);
  ensureDir(dir);
  const file = new File(fileURI);
  if (encoding === 'base64') {
    // Decode base64 to bytes and write as binary
    const binaryString = atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    file.write(bytes);
  } else {
    file.write(data);
  }
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

export function moveFile(sourceUri: string, targetUri: string) {
  // Normalize both URIs to ensure they're properly formatted
  const fromUri = normalizeFileUri(sourceUri);
  const toUri = normalizeFileUri(targetUri);

  const sourceFile = new File(fromUri);

  try {
    // Use the new File.move() API - handles move natively
    sourceFile.move(new File(toUri));
  } catch (error) {
    // If move fails (e.g., iOS Simulator bug), fall back to copy + delete
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('/..') || errorMessage.includes('not writable')) {
      console.log('moveAsync failed, using copy + delete fallback');
      // Copy the file
      const src = new File(fromUri);
      src.copy(new File(toUri));
      // Delete the source file
      try {
        const toDelete = new File(normalizeFileUri(fromUri));
        if (toDelete.exists) {
          toDelete.delete();
        }
      } catch (deleteError) {
        const deleteUri = normalizeFileUri(fromUri);
        const isTempFile =
          deleteUri.includes('/tmp/') || deleteUri.includes('/tmp');
        if (isTempFile) {
          console.log(
            `Failed to delete temp file (will be cleaned up automatically): ${deleteUri}`
          );
        } else {
          console.warn(
            `Failed to delete source file after copy: ${deleteUri}`,
            deleteError
          );
        }
      }
    } else {
      throw error;
    }
  }
}

export async function readFile(
  fileURI: string,
  _options?: { encoding?: 'utf8' | 'base64' }
) {
  const file = new File(fileURI);
  if (!file.exists) {
    throw new Error(`File does not exist: ${fileURI}`);
  }

  // For binary files (audio, images, etc.), always read as base64
  // This prevents data corruption from UTF-8 conversion
  const fileContent = await file.base64();

  // Convert base64 to ArrayBuffer properly
  return base64ToArrayBuffer(fileContent);
}

export function deleteFile(uri: string) {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export function copyFile(sourceUri: string, targetUri: string) {
  const source = new File(sourceUri);
  source.copy(new File(targetUri));
}

export function getDocumentDirectory() {
  return Paths.document.uri;
}

const encoder = new TextEncoder();

export function stringToArrayBuffer(str: string) {
  return encoder.encode(str).buffer as unknown as ArrayBuffer;
}

export function base64ToArrayBuffer(base64: string) {
  return decodeBase64(base64);
}

export function getLocalUri(filePath: string) {
  const docDir = getDocumentDirectory();
  // Ensure single slash between directory and file path
  const normalizedPath = filePath.startsWith('/')
    ? filePath.slice(1)
    : filePath;
  return `${docDir}/${normalizedPath}`;
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
  console.log('Saving audio file locally:', cleanSourceUri, newUri);

  // Initial delay to allow native module to finish writing the file
  // This is especially important for Android where the file write may not be fully flushed
  console.log('⏳ Waiting 100ms for native module to flush file...');
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Retry logic for file existence - iOS Simulator and Android can have timing issues
  // where the file isn't immediately available after native module writes it
  const maxRetries = 10; // Increased from 5 to 10
  const retryDelayMs = 200; // Increased from 100ms to 200ms
  let fileExistsNow = false;

  console.log(`🔍 Checking if file exists: ${cleanSourceUri}`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    fileExistsNow = fileExists(cleanSourceUri);
    if (fileExistsNow) {
      console.log(`✅ File found on attempt ${attempt + 1}/${maxRetries}`);
      break;
    }

    if (attempt < maxRetries - 1) {
      console.log(
        `File not found yet (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    } else {
      console.error(
        `❌ File not found after ${maxRetries} attempts (total ${maxRetries * retryDelayMs}ms)`
      );
    }
  }

  if (!fileExistsNow) {
    // Get file info for better error message
    const fileInfo = getFileInfo(cleanSourceUri);
    const errorMsg = `File does not exist after ${maxRetries} attempts: ${cleanSourceUri}. File info: ${JSON.stringify(fileInfo)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const newPath = getLocalAttachmentUri(newUri);
  ensureDir(getDirectory(newPath));

  // Debug: Log the URIs before moving
  console.log('Moving file:', {
    from: cleanSourceUri,
    to: newPath,
    fromLength: cleanSourceUri.length,
    toLength: newPath.length
  });

  try {
    moveFile(cleanSourceUri, newPath);
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('moveFile error details:', {
      error,
      sourceUri: cleanSourceUri,
      targetUri: newPath,
      sourceExists: fileExists(cleanSourceUri),
      targetExists: fileExists(newPath)
    });

    // Fallback: try to copy instead of move
    // This can happen if the source file was already moved/deleted or has permission issues
    if (sourceStillExists) {
      console.log(
        '⚠️ Move failed but source exists, attempting copy as fallback...'
      );
      try {
        await copyFile(cleanSourceUri, newPath);
        console.log('✅ Copy succeeded, now deleting source...');
        await deleteIfExists(cleanSourceUri);
        console.log('✅ File saved via copy + delete fallback');
      } catch (copyError) {
        console.error('❌ Copy fallback also failed:', copyError);
        throw error; // Throw original error
      }
    } else {
      // Source doesn't exist - this is the main error
      throw error;
    }
  }

  console.log('Audio file saved locally:', getLocalAttachmentUri(newUri));
  return newUri;
}
