import type { System } from '@/db/powersync/system';
import type { LocalizationKey } from '@/services/localizations';
import type { ProgressCallback } from '@/utils/backupUtils';

type TFunction = (
  key: LocalizationKey,
  options?: Record<string, string | number> | number
) => string;

// eslint-disable-next-line @typescript-eslint/require-await
export async function selectAndInitiateRestore(
  _system: System,
  _currentUserId: string,
  _t: TFunction,
  _onStart?: () => void,
  onFinish?: () => void,
  _onProgress?: ProgressCallback
) {
  onFinish?.();
}
