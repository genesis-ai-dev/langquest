/**
 * Web shim for file helpers used by UI components. We cannot access device
 * file URIs directly on the web, so these become safe no-ops.
 */

// eslint-disable-next-line @typescript-eslint/require-await
export async function deleteIfExists(
  _uri: string | null | undefined
): Promise<void> {
  URL.revokeObjectURL(_uri ?? '');
}

export function fileExists(_uri: string | null | undefined): boolean {
  return false;
}

export function ensureDir(_uri: string): void {
  // noop on web
}

export function writeFile(
  _fileURI: string,
  _data: string | Uint8Array,
  _options?: { encoding?: 'utf8' | 'base64' }
): void {
  // noop on web
}

export function readFile(
  _fileURI: string,
  _options?: { encoding?: 'utf8' | 'base64' }
): string {
  throw new Error('readFile is not supported on web');
}

export function deleteFile(_uri: string): void {
  return URL.revokeObjectURL(_uri);
}

export function copyFile(_sourceUri: string, _targetUri: string): void {
  // noop on web
}

export function getDocumentDirectory(): string {
  return '';
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
