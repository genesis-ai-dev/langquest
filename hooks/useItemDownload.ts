import React from 'react';

export function useItemDownloadStatus(
  item: { download_profiles?: string[] | null } | undefined,
  userId: string | undefined
): boolean {
  return React.useMemo(() => {
    if (!item || !userId || !item.download_profiles) return false;
    return item.download_profiles.includes(userId);
  }, [userId, item]);
}
