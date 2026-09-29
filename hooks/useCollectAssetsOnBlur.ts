import { run as runAssetGarbageCollector } from '@/database_services/assetGarbageCollectorService';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';

// Collect when the assets screen blurs (including unmount while focused).
// Running on focus races undo: the collector deletes rows the user just restored.
export function useCollectAssetsOnBlur(): void {
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        void runAssetGarbageCollector();
      };
    }, [])
  );
}
