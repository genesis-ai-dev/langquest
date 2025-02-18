import { system } from '@/db/powersync/system';

export function getLocalUriFromAssetId(assetId: string) {
  return system.attachmentQueue?.getLocalUri(
    system.attachmentQueue?.getLocalFilePathSuffix(assetId)
  );
}
