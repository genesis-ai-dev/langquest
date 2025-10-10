/**
 * Web shim for file helpers used by UI components. We cannot access device
 * file URIs directly on the web, so these become safe no-ops.
 */

import { AbstractSharedAttachmentQueue } from '@/db/powersync/AbstractSharedAttachmentQueue';
import { getOPFSHandle, opfsFileToBlobUrl } from './opfsUtils.web';

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
): Promise<string> {
  console.log('readFile', _fileURI);
  const sourceHandle = await getOPFSHandle(_fileURI, 'file');
  const sourceFile = await sourceHandle?.getFile();
  const sourceContent = await sourceFile?.text();
  if (!sourceContent) {
    throw new Error(`File does not exist: ${_fileURI}`);
  }
  return _options?.encoding === 'base64' ? btoa(sourceContent) : sourceContent;
}

export async function deleteFile(_uri: string) {
  console.log('deleteFile', _uri);
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
  console.log('getFileInfo', _uri);
  const handle = await getOPFSHandle(_uri ?? '', 'file');
  const file = await handle?.getFile();
  return {
    uri: _uri ?? '',
    exists: !!file,
    isDirectory: false,
    size: file?.size,
    lastModified: file?.lastModified
  };
}

// save the file in the browser locally
export async function saveAudioLocally(uri: string) {
  console.log('saveAudioFileLocally', uri);
  console.log('fetching blob from', uri);
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = blob.type.split(';')[0]!.split('/').pop(); // "audio/webm; codecs=opus"
  const fileName = `${uri.split('/').pop()}.${extension}`;
  console.log('fileName', fileName);
  if (!fileName) {
    throw new Error('Failed to get file name');
  }
  uri = `local/${fileName}`;
  console.log('writing blob to OPFS', uri);
  const fileHandle = await getOPFSHandle(getLocalFilePathSuffix(uri), 'file', {
    create: true
  });

  if (!fileHandle) {
    throw new Error(`Failed to create file handle for path: ${uri}`);
  }

  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return uri;
}

export function getLocalFilePathSuffix(filename: string): string {
  return `${AbstractSharedAttachmentQueue.SHARED_DIRECTORY}/${filename}`;
}

export function getLocalAttachmentUri(filePath: string) {
  return getLocalUri(
    getLocalFilePathSuffix(`local/${filePath.split('/').pop()}`)
  );
}

export async function getLocalAttachmentUriOPFS(filePath: string) {
  const localUri = getLocalAttachmentUri(filePath);
  const opfsUri = opfsFileToBlobUrl(localUri);
  return opfsUri;
}
