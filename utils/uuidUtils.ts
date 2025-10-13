/**
 * UUID Utilities
 * 
 * NOTE (2025-10): As of 10/10/2025, new records always use dashed UUIDs even in sqlite.
 * However, these utilities remain necessary for backward compatibility with:
 * - Existing local records created before the fix (non-dashed)
 * - Hybrid queries that merge local and synced data
 * 
 * These can be removed in the future once all local data is published/migrated.
 * 
 * Our code created UUIDs without dashes in local tables: 33988c3fb7aad765539524f653362c48
 * Postgres stores UUIDs with dashes: 33988c3f-b7aa-d765-5395-24f653362c48
 * 
 * This causes deduplication issues when comparing IDs from different sources.
 * These utilities normalize UUIDs for safe comparison.
 */

/**
 * Normalize a UUID by removing dashes
 * Use this for Map keys and comparisons to ensure consistency
 * 
 * @example
 * normalizeUuid('33988c3f-b7aa-d765-5395-24f653362c48')
 * // Returns: '33988c3fb7aad765539524f653362c48'
 * 
 * normalizeUuid(12345)
 * // Returns: '12345' (for numeric IDs)
 */
export function normalizeUuid(uuid: string | number | undefined | null): string {
    if (uuid === undefined || uuid === null) return '';
    return uuid.toString().replace(/-/g, '');
}

/**
 * Format a UUID with standard dashes (8-4-4-4-12)
 * Use this when displaying UUIDs or sending to Postgres
 * 
 * @example
 * formatUuid('33988c3fb7aad765539524f653362c48')
 * // Returns: '33988c3f-b7aa-d765-5395-24f653362c48'
 */
export function formatUuid(uuid: string): string {
    // Remove any existing dashes first
    const normalized = uuid.replace(/-/g, '');

    // Validate length
    if (normalized.length !== 32) {
        console.warn(`Invalid UUID length: ${uuid}`);
        return uuid; // Return as-is if invalid
    }

    // Format as: 8-4-4-4-12
    return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

/**
 * Compare two UUIDs for equality, ignoring dash formatting
 * 
 * @example
 * uuidsEqual('33988c3f-b7aa-d765-5395-24f653362c48', '33988c3fb7aad765539524f653362c48')
 * // Returns: true
 */
export function uuidsEqual(uuid1: string, uuid2: string): boolean {
    return normalizeUuid(uuid1) === normalizeUuid(uuid2);
}

/**
 * Deduplicate items by UUID, handling both dashed and non-dashed formats
 * Priority: synced > local > cloud
 * 
 * @example
 * const items = [
 *   { id: '33988c3f-b7aa...', source: 'synced', data: 'A' },
 *   { id: '33988c3fb7aa...', source: 'local', data: 'B' }
 * ];
 * const deduped = deduplicateByUuid(items);
 * // Returns: [{ id: '33988c3f-b7aa...', source: 'synced', data: 'A' }]
 */
export function deduplicateByUuid<T extends { id?: string; source?: string }>(
    items: T[],
    sourceField: keyof T = 'source' as keyof T
): T[] {
    const map = new Map<string, T>();

    items.forEach((item) => {
        // Skip items without IDs
        if (!item.id) return;

        const normalizedId = normalizeUuid(item.id);
        if (!normalizedId) return; // Skip empty IDs

        const existing = map.get(normalizedId);

        if (!existing) {
            map.set(normalizedId, item);
        } else {
            // Priority: synced (3) > local (2) > cloud (1)
            const getPriority = (source: string | undefined) => {
                if (source === 'synced') return 3;
                if (source === 'local') return 2;
                if (source === 'cloud') return 1;
                return 0;
            };

            const existingPriority = getPriority(existing[sourceField] as string | undefined);
            const itemPriority = getPriority(item[sourceField] as string | undefined);

            if (itemPriority > existingPriority) {
                map.set(normalizedId, item);
            }
        }
    });

    return Array.from(map.values());
}

