import type { System } from '@/db/powersync/system';

// eslint-disable-next-line @typescript-eslint/require-await
export async function requestBackupDirectory(): Promise<string | null> {
  return null;
}

export type ProgressCallback = (progress: number, total: number) => void;

export function prepareBackupPaths(_timestamp: string): {
  mainBackupDirName: string;
} {
  return { mainBackupDirName: '' };
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function backupUnsyncedAudio(
  _system: System,
  _baseDirectoryUri: string,
  _onProgress?: ProgressCallback
): Promise<{ copied: number; alreadyExists: number; errors: string[] }> {
  return { copied: 0, alreadyExists: 0, errors: [] };
}

