import * as drizzleSchema from '@/db/drizzleSchema';
import * as drizzleSchemaLocal from '@/db/drizzleSchemaLocal';
import * as drizzleSchemaSynced from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import type { HybridDataSource } from '@/views/new/useHybridData';
import type { AnyColumn, GetColumnData, SQL, Table } from 'drizzle-orm';
import { and, eq, getOrderByOperators } from 'drizzle-orm';

const {
  quest_tag_categories: _,
  asset_tag_categories: _2,
  project_closure: _3,
  quest_closure: _4,
  quest_aggregates: _5,
  ...tablesOnly
} = drizzleSchema;

export { tablesOnly };

const {
  quest_tag_categories_local: _local,
  asset_tag_categories_local: _local2,
  project_closure_local: _local3,
  quest_closure_local: _local4,
  quest_aggregates_local: _local5,
  ...localTablesOnly
} = drizzleSchemaLocal;

export { localTablesOnly };

// TODO:
const LOCAL_MODE = false;

type TablesOnlyKeys = Exclude<keyof typeof tablesOnly, `${string}Relations`>;
type LocalKeyFor<T extends TablesOnlyKeys> = `${Extract<T, string>}_local` &
  keyof typeof drizzleSchemaLocal;
type SyncedKeyFor<T extends TablesOnlyKeys> = `${Extract<T, string>}_synced` &
  keyof typeof drizzleSchemaSynced;

export function sourceLocalOverrideOptions(source: HybridDataSource) {
  return { localOverride: source === 'local' };
}

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
  options: { localOverride: true }
): (typeof drizzleSchemaLocal)[LocalKeyFor<T>];
export function resolveTable<T extends TablesOnlyKeys>(
  table: T,
  options: { localOverride: false }
): (typeof drizzleSchemaSynced)[SyncedKeyFor<T>];
export function resolveTable<T extends TablesOnlyKeys>(
  table: T,
  options?: { localOverride?: boolean }
):
  | (typeof drizzleSchemaLocal)[LocalKeyFor<T>]
  | (typeof drizzleSchemaSynced)[SyncedKeyFor<T>];
export function resolveTable<T extends TablesOnlyKeys>(
  table: T,
  options: { localOverride?: boolean } = { localOverride: LOCAL_MODE }
) {
  return options.localOverride
    ? (drizzleSchemaLocal[
        `${table}_local` as LocalKeyFor<T>
      ] as (typeof drizzleSchemaLocal)[LocalKeyFor<T>])
    : (drizzleSchemaSynced[
        `${table}_synced` as SyncedKeyFor<T>
      ] as (typeof drizzleSchemaSynced)[SyncedKeyFor<T>]);
}

export type WithSource<T> = T extends readonly unknown[]
  ? T[number] & { source: HybridDataSource }
  : T & { source: HybridDataSource };

export type SortOrder = 'asc' | 'desc';

export function sortingHelper<
  T extends Table,
  K extends keyof T['_']['columns']
>(table: T, sortField: K, sortOrder: SortOrder) {
  const orderByOperators = getOrderByOperators();
  const column = table[sortField as keyof T] as unknown as AnyColumn;
  return orderByOperators[sortOrder](column);
}

export function blockedContentQuery(profileId: string, contentType: string) {
  return system.db
    .select({ content_id: drizzleSchema.blocked_content.content_id })
    .from(drizzleSchema.blocked_content)
    .where(
      and(
        eq(drizzleSchema.blocked_content.profile_id, profileId),
        eq(drizzleSchema.blocked_content.content_table, contentType)
      )
    );
}

export function blockedUsersQuery(profileId: string) {
  return system.db
    .select({ blocked_id: drizzleSchema.blocked_users.blocked_id })
    .from(drizzleSchema.blocked_users)
    .where(eq(drizzleSchema.blocked_users.blocker_id, profileId));
}

export const aliasedColumn = <T extends AnyColumn>(
  column: T,
  alias: string
): SQL.Aliased<GetColumnData<T>> => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return column.getSQL().mapWith(column.mapFromDriverValue).as(alias);
};
