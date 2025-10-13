/**
 * Custom error for when a file or directory is not found in the OPFS.
 */
export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Memoize the OPFS root handle to avoid fetching it on every call.
let opfsRootPromise: Promise<FileSystemDirectoryHandle> | null = null;
async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!navigator.storage?.getDirectory) {
    throw new Error(
      'The File System Access API is not supported in this browser.'
    );
  }

  if (opfsRootPromise) {
    return opfsRootPromise;
  }
  // This will be called only once
  opfsRootPromise = navigator.storage.getDirectory();
  return opfsRootPromise;
}

/**
 * Gets a file or directory handle from a nested path within the OPFS.
 *
 * @param path The full path string (e.g., 'images/nature/photo.jpg').
 * @param kind The kind of handle to retrieve ('file' or 'directory').
 * @param options An object containing options for retrieving the handle, such as `{ create: true }`.
 * @returns A promise that resolves with the handle or null if the path is invalid or an entry is not found.
 */
export async function getOPFSHandle<T extends 'file' | 'directory'>(
  path: string,
  kind: T,
  options: T extends 'file'
    ? FileSystemGetFileOptions
    : FileSystemGetDirectoryOptions = {} as T extends 'file'
    ? FileSystemGetFileOptions
    : FileSystemGetDirectoryOptions
): Promise<
  T extends 'file'
    ? FileSystemFileHandle | null
    : FileSystemDirectoryHandle | null
> {
  let currentHandle: FileSystemDirectoryHandle;
  try {
    currentHandle = await getOPFSRoot();
  } catch (error) {
    console.error('Could not get the OPFS root directory.', error);
    return null;
  }

  const pathSegments = path.split('/').filter(Boolean);
  const { create = false } = options;

  if (pathSegments.length === 0) {
    return (kind === 'directory' ? currentHandle : null) as T extends 'file'
      ? FileSystemFileHandle | null
      : FileSystemDirectoryHandle | null;
  }

  try {
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i]!;
      const isLastSegment = i === pathSegments.length - 1;

      if (isLastSegment) {
        if (kind === 'file') {
          return (await currentHandle.getFileHandle(segment, {
            create
          })) as T extends 'file'
            ? FileSystemFileHandle | null
            : FileSystemDirectoryHandle | null;
        } else {
          return (await currentHandle.getDirectoryHandle(segment, {
            create
          })) as T extends 'file'
            ? FileSystemFileHandle | null
            : FileSystemDirectoryHandle | null;
        }
      } else {
        // Only apply `create` option for intermediate directories if requested
        currentHandle = await currentHandle.getDirectoryHandle(segment, {
          create
        });
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      console.warn(`OPFS Path segment "${path}" was not found.`);
    } else {
      console.error(`Error traversing path:`, error);
    }
  }
  return null;
}

/**
 * Converts an OPFS file to a Blob.
 *
 * @param path The full path string to the file in OPFS (e.g., 'audio/recording.mp3').
 * @returns A promise that resolves with the Blob or null if the file is not found.
 */
export async function opfsFileToBlobUrl(path: string) {
  const fileHandle = await getOPFSHandle(path, 'file');
  if (!fileHandle) throw new Error('File not found');

  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}
