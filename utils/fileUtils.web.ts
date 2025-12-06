/**
 * Web shim for file helpers used by UI components. We cannot access device
 * file URIs directly on the web, so these become safe no-ops.
 */

import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { getOPFSHandle, opfsFileToBlobUrl } from './opfsUtils.web';

export function getFileName(uri: string) {
  return uri.split('/').pop();
}

export async function deleteIfExists(
  _uri: string | null | undefined
): Promise<void> {
  console.log('deleteIfExists', _uri);
  if (_uri && (await fileExists(_uri))) {
    await deleteFile(_uri);
  }
}

export async function fileExists(
  _uri: string | null | undefined
): Promise<boolean> {
  console.log('fileExists', _uri);
  const fileInfo = await getFileInfo(_uri);
  console.log('file does exist', _uri, fileInfo.exists);
  return fileInfo.exists;
}

export async function ensureDir(_uri: string): Promise<void> {
  console.log('ensureDir', _uri);
  const directoryHandle = await getOPFSHandle(_uri, 'directory', {
    create: true
  });
  if (!directoryHandle) {
    throw new Error(`Directory could not be created: ${_uri}`);
  }
}

export async function writeFile(
  _fileURI: string,
  _data: string | Uint8Array,
  _options?: { encoding?: 'utf8' | 'base64' }
) {
  console.log('writeFile', _fileURI);
  const pathSegments = _fileURI.split('/');
  const fileName = pathSegments.pop();

  if (!fileName) {
    throw new Error('Invalid file URI: no filename found');
  }

  const fileHandle = await getOPFSHandle(_fileURI, 'file', { create: true });

  if (!fileHandle) {
    throw new Error(`File does not exist: ${_fileURI}`);
  }

  // Write content to the file
  if (_data) {
    const writable = await fileHandle.createWritable();

    let content: string | ArrayBuffer;
    if (typeof _data === 'string') {
      if (_options?.encoding === 'base64') {
        // Convert base64 string to ArrayBuffer
        const binaryString = atob(_data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        content = bytes.buffer;
      } else {
        content = _data;
      }
    } else {
      content = _data.buffer as ArrayBuffer;
    }

    await writable.write(content);
    await writable.close();
  }
}

export async function readFile(
  _fileURI: string,
  _options?: { encoding?: 'utf8' | 'base64' }
): Promise<ArrayBuffer> {
  console.log('readFile', _fileURI);
  const sourceHandle = await getOPFSHandle(_fileURI, 'file');
  const sourceFile = await sourceHandle?.getFile();

  if (!sourceFile) {
    throw new Error(`File does not exist: ${_fileURI}`);
  }

  // For binary files (audio, images, etc.), always read as ArrayBuffer
  // This prevents data corruption from UTF-8 conversion
  // Match native behavior: always return ArrayBuffer regardless of encoding option
  const arrayBuffer = await sourceFile.arrayBuffer();

  console.log('sourceContent (ArrayBuffer)', arrayBuffer.byteLength, 'bytes');
  return arrayBuffer;
}

export async function deleteFile(_uri: string) {
  console.log('deleteFile', _uri);

  // If it's a blob URL, revoke it and return early
  if (_uri.startsWith('blob:')) {
    console.log('Revoking blob URL:', _uri);
    URL.revokeObjectURL(_uri);
    return;
  }

  // Otherwise, proceed with OPFS file deletion
  const pathSegments = _uri.split('/');
  const fileName = pathSegments.pop();
  const directoryPath = pathSegments.join('/');

  const directory = await getOPFSHandle(directoryPath, 'directory');
  if (fileName) await directory?.removeEntry(fileName);
}

export async function moveFile(_sourceUri: string, _targetUri: string) {
  console.log('moveFile', _sourceUri, _targetUri);
  try {
    await copyFile(_sourceUri, _targetUri);
    await deleteIfExists(_sourceUri);
  } catch (error) {
    console.error('[MOVE FILE] Error', error);
    throw error;
  }
}

export async function copyFile(_sourceUri: string, _targetUri: string) {
  console.log('copyFile', _sourceUri, _targetUri);
  const sourceHandle = await getOPFSHandle(_sourceUri, 'file');
  const sourceFile = await sourceHandle?.getFile();
  const sourceContent = await sourceFile?.arrayBuffer();

  if (!sourceContent) {
    throw new Error(`File does not exist: ${_sourceUri}`);
  }

  const targetFile = await getOPFSHandle(_targetUri, 'file', { create: true });
  const writable = await targetFile?.createWritable();
  await writable?.write(sourceContent);
  await writable?.close();
}

export function getDocumentDirectory(): string {
  console.log('getDocumentDirectory');
  return '';
}

export function getLocalUri(filePath: string) {
  console.log('getLocalUri', filePath);
  // const { data } = system.supabaseConnector.client.storage
  //   .from(AppConfig.supabaseBucket)
  //   .getPublicUrl(
  //     filePath.replace(`${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/`, '')
  //   );
  return `${getDocumentDirectory()}${filePath}`;
  // return data.publicUrl;
}

export async function getFileInfo(_uri: string | null | undefined) {
  if (_uri?.startsWith('blob:')) {
    const response = await fetch(_uri);
    const blob = await response.blob();
    return {
      exists: true,
      isDirectory: false,
      size: blob.size,
      lastModified: 0
    };
  }
  console.log('getFileInfo', _uri);
  const handle = await getOPFSHandle(_uri ?? '', 'file');
  const file = await handle?.getFile();
  const fileInfo = {
    uri: _uri ?? '',
    exists: !!file,
    isDirectory: false,
    size: file?.size,
    lastModified: file?.lastModified
  };
  console.log('fileInfo', fileInfo);
  return fileInfo;
}

export function getLocalFilePathSuffix(filename: string): string {
  return `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${filename}`;
}

export async function getLocalAttachmentUriWithOPFS(filePath: string) {
  const localUri = getLocalAttachmentUri(filePath);
  const opfsUri = opfsFileToBlobUrl(localUri);
  return opfsUri;
}

export function getLocalAttachmentUri(filePath: string) {
  return getLocalUri(getLocalFilePathSuffix(filePath));
}

// save the file in the browser locally
export async function saveAudioLocally(uri: string) {
  // Validate that we received a blob URL (expected on web)
  if (!uri.startsWith('blob:')) {
    throw new Error(
      `Expected blob URL on web platform, got: ${uri.substring(0, 100)}`
    );
  }

  console.log('saveAudioFileLocally', uri);

  try {
    console.log('fetching blob from', uri);
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch blob: ${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();
    const extension = blob.type.split(';')[0]!.split('/').pop(); // "audio/webm; codecs=opus"
    const fileName = `${getFileName(uri)}.${extension}`;
    console.log('fileName', fileName);

    if (!fileName) {
      throw new Error('Failed to get file name');
    }

    const localUri = `local/${fileName}`;
    console.log('writing blob to OPFS', localUri);

    const fileHandle = await getOPFSHandle(
      getLocalFilePathSuffix(localUri),
      'file',
      { create: true }
    );

    if (!fileHandle) {
      throw new Error(`Failed to create file handle for path: ${localUri}`);
    }

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    console.log('✅ Successfully saved audio locally:', localUri);

    // Return the local path format, NOT the blob URL
    return localUri;
  } catch (error) {
    console.error('CRITICAL: Failed to save audio locally:', error);
    throw error; // Don't silently fail
  }
}
