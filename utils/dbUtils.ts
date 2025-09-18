import * as drizzleSchema from '@/db/drizzleSchema';
import * as drizzleSchemaLocal from '@/db/drizzleSchemaLocal';
import type { tablesOnly } from '@/db/powersync/system';

// TODO:
const LOCAL_MODE = true;

type TablesOnlyKeys = Exclude<keyof typeof tablesOnly, `${string}Relations`>;
type LocalKeyFor<T extends TablesOnlyKeys> = `${Extract<T, string>}_local` &
  keyof typeof drizzleSchemaLocal;

/**
 * Resolves the correct table object (local or remote) for a given table name.
 *
 * This utility determines whether to use the local or remote table variant
 * based on the global LOCAL_MODE setting or a specific override parameter.
 * Useful for database operations that need to target either local or remote storage.
 *
 * @param table - The base table name (without '_local' suffix)
 * @param localOverride - Whether to force using the local table variant
 * @returns The appropriate table reference (local or remote)
 */
export function resolveTable<T extends TablesOnlyKeys>(
  table: T,
  options: { localOverride?: boolean } = {}
) {
  const useLocal = LOCAL_MODE || !!options.localOverride;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return useLocal
    ? (drizzleSchemaLocal[
        `${table}_local` as LocalKeyFor<T>
      ] as (typeof drizzleSchemaLocal)[LocalKeyFor<T>])
    : (drizzleSchema[table] as (typeof drizzleSchema)[T]);
}
