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
    let sawSubscription = false;
    void getQueuedAssetIds().then((list) => {
      if (!alive || sawSubscription) return;
      setIds(new Set(list));
    });
    const unsubscribe = subscribeAssetGcQueue(() => {
      if (!alive) return;
      sawSubscription = true;
      setIds(new Set(getCachedQueuedAssetIds()));
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return ids;
}
