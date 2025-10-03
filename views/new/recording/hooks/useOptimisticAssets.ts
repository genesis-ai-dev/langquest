/**
 * useOptimisticAssets - Manages optimistic UI for instant asset appearance
 * 
 * Assets appear immediately in the UI while database operations happen in background.
 * Automatic reconciliation when real data arrives.
 */

import React from 'react';

export interface OptimisticAsset {
    id: string;
    name: string;
    order_index: number;
    source: 'optimistic';
    created_at: string;
    tempId: string;
}

interface UseOptimisticAssetsReturn {
    optimisticAssets: OptimisticAsset[];
    addOptimistic: (asset: OptimisticAsset) => void;
    removeOptimistic: (id: string) => void;
    clearOptimistic: () => void;
}

export function useOptimisticAssets(
    realAssets: any[] | undefined
): UseOptimisticAssetsReturn {
    const [optimisticAssets, setOptimisticAssets] = React.useState<OptimisticAsset[]>([]);

    const addOptimistic = React.useCallback((asset: OptimisticAsset) => {
        setOptimisticAssets((prev) => [...prev, asset]);
        console.log('✨ Optimistic asset added:', asset.name, 'at position', asset.order_index);
    }, []);

    const removeOptimistic = React.useCallback((id: string) => {
        setOptimisticAssets((prev) => prev.filter((opt) => opt.id !== id));
        console.log('🔄 Optimistic asset removed:', id);
    }, []);

    const clearOptimistic = React.useCallback(() => {
        setOptimisticAssets([]);
    }, []);

    // Cleanup optimistic assets when real data arrives
    React.useEffect(() => {
        // Skip if no optimistic assets to clean up
        if (optimisticAssets.length === 0 || !realAssets) return;

        const realIds = new Set(
            realAssets
                .map((a) => (a as { id?: string }).id)
                .filter((id): id is string => Boolean(id))
        );

        // Remove any optimistic assets that now exist in real data
        setOptimisticAssets((prev) => {
            const filtered = prev.filter((opt) => !realIds.has(opt.id));
            // Only update if something actually changed (prevent loops)
            if (filtered.length === prev.length) return prev;

            console.log(
                `🧹 Cleaned up ${prev.length - filtered.length} optimistic assets (now in DB)`
            );
            return filtered;
        });
    }, [realAssets, optimisticAssets.length]);

    return {
        optimisticAssets,
        addOptimistic,
        removeOptimistic,
        clearOptimistic
    };
}

