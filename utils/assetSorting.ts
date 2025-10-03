/**
 * Unified asset sorting logic
 * 
 * Sorts assets by:
 * 1. order_index (treating null/undefined as 0 for consistent ordering)
 * 2. created_at timestamp (for assets with same order_index)
 * 3. name (natural alphanumeric sort as final tiebreaker)
 * 
 * This ensures that:
 * - Assets with explicit order_index values always sort correctly
 * - Assets without order_index (0, null, or undefined) sort together by creation time
 * - Mixed scenarios (old assets with order_index=0 and new assets with explicit values) work correctly
 */

interface SortableAsset {
    id: string;
    name: string;
    order_index?: number | null;
    created_at?: string | Date | null;
}

/**
 * Sorts assets using the unified sorting strategy.
 * This ensures consistent ordering across all views (list view, recording view, etc.)
 * 
 * @param assets - Array of assets to sort
 * @returns Sorted array of assets
 */
export function sortAssets<T extends SortableAsset>(assets: T[]): T[] {
    return [...assets].sort((a, b) => {
        const aOrder = typeof a.order_index === 'number' ? a.order_index : 0;
        const bOrder = typeof b.order_index === 'number' ? b.order_index : 0;

        // 1. Sort by order_index (treat null/undefined as 0)
        // Assets with explicit order_index always sort by that value
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        // 2. If order_index is the same, sort by created_at timestamp
        const ad = a.created_at ? String(a.created_at) : '';
        const bd = b.created_at ? String(b.created_at) : '';
        if (ad !== bd) {
            return ad.localeCompare(bd);
        }

        // 3. Finally by name (natural alphanumeric sort)
        return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });
}

