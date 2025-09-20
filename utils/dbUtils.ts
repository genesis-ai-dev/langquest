import * as drizzleSchema from '@/db/drizzleSchema';
import * as drizzleSchemaLocal from '@/db/drizzleSchemaLocal';
import type { tablesOnly } from '@/db/powersync/system';
import { system } from '@/db/powersync/system';
import { substituteParams } from '@/hooks/useHybridSupabaseQuery';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { hybridDataSourceOptions } from '@/views/new/useHybridData';
import type { CompilableQuery } from '@powersync/react-native';
import type { AnyColumn, Query, Table } from 'drizzle-orm';
import { getOrderByOperators } from 'drizzle-orm';

// TODO:
const LOCAL_MODE = false;

export type OfflineQuerySource = keyof Omit<
  typeof hybridDataSourceOptions,
  'cloud'
>;

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
  options: { localOverride?: boolean } = { localOverride: LOCAL_MODE }
) {
  return options.localOverride
    ? (drizzleSchemaLocal[
        `${table}_local` as LocalKeyFor<T>
      ] as (typeof drizzleSchemaLocal)[LocalKeyFor<T>])
    : (drizzleSchema[table] as (typeof drizzleSchema)[T]);
}

type QueryInput<T> = string | CompilableQuery<T> | { toSQL: () => Query };

export function mergeSQL<T>(query: QueryInput<T>) {
  let sql = '';
  let params: unknown[] = [];

  if (typeof query === 'string') {
    sql = query;
    params = [];
  } else if (typeof query === 'object' && 'compile' in query) {
    // Handle CompilableQuery
    const compiled = query.compile();
    sql = compiled.sql;
    params = Array.from(compiled.parameters);
  } else if (typeof query === 'object' && 'toSQL' in query) {
    // Handle Drizzle query with toSQL method
    const queryResult = query.toSQL();
    sql = queryResult.sql;
    params = queryResult.params;
  }

  if (sql === '') {
    throw new Error('mergeSQL: query is empty');
  }

  const substituted = substituteParams(sql, params);

  // Disallow aliases to prevent unsafe table-name replacement from breaking references
  // Matches: FROM "table" "alias" or JOIN "table" "alias"
  const aliasPattern =
    /\b(FROM|JOIN)\s+"[A-Za-z_][A-Za-z0-9_]*"\s+"[A-Za-z_][A-Za-z0-9_]*"/g;
  if (aliasPattern.test(substituted)) {
    throw new Error('mergeQuery: aliased tables are not supported.');
  }

  const mainSource = hybridDataSourceOptions.synced;
  const mainQuery = `SELECT sub.*, '${mainSource}' AS source FROM (${substituted}) AS sub`;
  let localQuery = mainQuery.replace(
    `'${mainSource}'`,
    `'${hybridDataSourceOptions.local}'`
  );
  Object.keys(drizzleSchema).forEach((key) => {
    localQuery = localQuery.replaceAll(`"${key}"`, `"${key}_local"`);
  });
  const unionQuery = `${mainQuery} UNION ${localQuery}`;
  return unionQuery;
}

export type WithSource<T> = T extends readonly unknown[]
  ? T[number] & { source: HybridDataSource }
  : T & { source: HybridDataSource };

export type MergeQueryResult<T extends QueryInput<T>> = WithSource<Awaited<T>>;

export async function mergeQuery<T extends QueryInput<T>>(
  query: T,
  mergedSQL?: string
) {
  const result = await system.powersync.execute(mergedSQL ?? mergeSQL(query));
  const rows = result.rows?._array as MergeQueryResult<T>[];
  return rows;
}

export function toMergeCompilableQuery<T extends QueryInput<T>>(query: T) {
  const unionQuery = mergeSQL(query);

  return {
    execute: async () => {
      const data = await mergeQuery(query, unionQuery);
      console.log('toMergeCompilableQuery', data);
      return data;
    },
    compile: () => ({
      sql: unionQuery,
      parameters: []
    })
  } as CompilableQuery<MergeQueryResult<T>[]>;
}

export type SortOrder = 'asc' | 'desc';

export function sortingHelper<
  T extends Table,
  K extends keyof T['_']['columns']
>(table: T, sortField: K, sortOrder: SortOrder) {
  const orderByOperators = getOrderByOperators();
  const column = table[sortField as keyof T] as unknown as AnyColumn;
  return orderByOperators[sortOrder](column);
}
