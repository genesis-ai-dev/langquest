/**
 * useSelectionMode - WhatsApp-style multi-select for batch operations
 *
 * Handles:
 * - Selection mode toggle
 * - Selected items tracking
 * - Enter/exit selection
 */

import React from 'react';

interface UseSelectionModeReturn {
  isSelectionMode: boolean;
  selectedAssetIds: Set<string>;
  enterSelection: (assetId: string) => void;
  toggleSelect: (assetId: string) => void;
  cancelSelection: () => void;
  selectMultiple: (assetIds: string[]) => void;
}

export function useSelectionMode(): UseSelectionModeReturn {
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(
    new Set()
  );

  const enterSelection = React.useCallback((assetId: string) => {
    setIsSelectionMode(true);
    setSelectedAssetIds(new Set([assetId]));
  }, []);

  const toggleSelect = React.useCallback((assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const cancelSelection = React.useCallback(() => {
    setIsSelectionMode(false);
    setSelectedAssetIds(new Set());
  }, []);

  const selectMultiple = React.useCallback((assetIds: string[]) => {
    setIsSelectionMode(true);
    setSelectedAssetIds(new Set(assetIds));
  }, []);

  return {
    isSelectionMode,
    selectedAssetIds,
    enterSelection,
    toggleSelect,
    cancelSelection,
    selectMultiple
  };
}
