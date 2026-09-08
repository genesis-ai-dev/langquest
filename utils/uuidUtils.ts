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
export function normalizeUuid(
  uuid: string | number | undefined | null
): string {
  if (uuid === undefined || uuid === null) return '';
  return uuid.toString().replace(/-/g, '');
}

/**
 * Restore dashed UUID form. PowerSync's raw `id` column may omit hyphens;
 * Drizzle `$defaultFn` also mints a new id when `values.id` is missing.
 */
export function toDashedUuid(
  uuid: string | number | undefined | null
): string {
  const compact = normalizeUuid(uuid).toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    return uuid == null ? '' : uuid.toString();
  }
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}
