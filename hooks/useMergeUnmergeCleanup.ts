import { triggerFlash } from '@/hooks/useFlashHighlight';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

/**
 * Shared post-operation cleanup for merge and unmerge across all asset views.
 * Handles: cancel selection, flash highlight, query invalidation.
 */
export function useMergeUnmergeCleanup(cancelSelection: () => void) {
  const queryClient = useQueryClient();

  const afterMerge = React.useCallback(
    (targetAssetId: string) => {
      cancelSelection();
      triggerFlash([targetAssetId]);
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    [cancelSelection, queryClient]
  );

  const afterUnmerge = React.useCallback(
    (originalAssetId: string, newAssetIds: string[]) => {
      cancelSelection();
      triggerFlash([originalAssetId, ...newAssetIds]);
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    [cancelSelection, queryClient]
  );

  return { afterMerge, afterUnmerge };
}
