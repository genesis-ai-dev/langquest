import {
  getCachedQueuedAssetIds,
  getQueuedAssetIds,
  subscribeAssetGcQueue
} from '@/database_services/assetGarbageCollectorService';
import React from 'react';

export function useQueuedAssetIdSet(): Set<string> {
  const [ids, setIds] = React.useState(
    () => new Set(getCachedQueuedAssetIds())
  );

  React.useEffect(() => {
    let alive = true;
    void getQueuedAssetIds().then((list) => {
      if (alive) setIds(new Set(list));
    });
    return subscribeAssetGcQueue(() => {
      setIds(new Set(getCachedQueuedAssetIds()));
    });
  }, []);

  return ids;
}
