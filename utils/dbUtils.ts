import * as drizzleSchema from '@/db/drizzleSchema';
import * as drizzleSchemaLocal from '@/db/drizzleSchemaLocal';
import { system } from '@/db/powersync/system';
import { substituteParams } from '@/hooks/useHybridSupabaseQuery';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { hybridDataSourceOptions } from '@/views/new/useHybridData';
import type { CompilableQuery } from '@powersync/react-native';
import type { AnyColumn, Query, Table } from 'drizzle-orm';
import { getOrderByOperators, getTableColumns } from 'drizzle-orm';

const {
  quest_tag_categories: _,
  asset_tag_categories: _2,
  ...tablesOnly
} = drizzleSchema;

export { tablesOnly };

const {
  quest_tag_categories_local: _local,
  asset_tag_categories_local: _local2,
  ...localTablesOnly
} = drizzleSchemaLocal;

export { localTablesOnly };

// TODO:
const LOCAL_MODE = false;

/**
 * JSON Parsing Implementation
 *
 * This module automatically parses two types of JSON columns:
 * 1. Columns defined with text({ mode: 'json' }) in Drizzle schema
 * 2. Results from json_group_array(json_object(...)) SQL functions
 */

// Map of table names to their JSON column names
type JSONColumnMap = Map<string, Set<string>>;

function getJSONColumnsFromSchema(
  schema: Record<string, unknown>
): JSONColumnMap {
  const jsonColumns = new Map<string, Set<string>>();

  for (const [tableName, table] of Object.entries(schema)) {
    // Skip relations and other non-table objects
    if (
      tableName.endsWith('Relations') ||
      typeof table !== 'object' ||
      !table
    ) {
      continue;
    }

    try {
      // Use getTableColumns to get column metadata if possible
      const columns = getTableColumns(table as Table);
      const tableJsonColumns = new Set<string>();

      for (const [columnName, column] of Object.entries(columns)) {
        const columnAny = column as unknown as Record<string, unknown>;

        // Only check for text mode: 'json'
        if (
          columnAny.config &&
          typeof columnAny.config === 'object' &&
          (columnAny.config as Record<string, unknown>).mode === 'json'
        ) {
          tableJsonColumns.add(columnName);
        }
      }

      if (tableJsonColumns.size > 0) {
        jsonColumns.set(tableName, tableJsonColumns);
      }
    } catch {
      // If getTableColumns fails, fall back to direct property access
      try {
        if (!('_' in table)) {
          continue;
        }

        const tableObj = table as Record<string, unknown>;
        const tableInternal = tableObj._ as Record<string, unknown> | undefined;

        if (
          !tableInternal?.columns ||
          typeof tableInternal.columns !== 'object'
        ) {
          continue;
        }

        const tableJsonColumns = new Set<string>();

        for (const [columnName, column] of Object.entries(
          tableInternal.columns as Record<string, unknown>
        )) {
          const columnConfig = column as Record<string, unknown>;
          // Only check for text mode: 'json'
          if (
            columnConfig.config &&
            typeof columnConfig.config === 'object' &&
            (columnConfig.config as Record<string, unknown>).mode === 'json'
          ) {
            tableJsonColumns.add(columnName);
          }
        }

        if (tableJsonColumns.size > 0) {
          jsonColumns.set(tableName, tableJsonColumns);
        }
      } catch {
        // Skip this table if we can't process it
      }
    }
  }

  return jsonColumns;
}

// Initialize JSON column maps immediately
const JSON_COLUMNS_MAP = getJSONColumnsFromSchema(tablesOnly);
const JSON_COLUMNS_MAP_LOCAL = getJSONColumnsFromSchema(localTablesOnly);

// Detect columns from json_group_array(json_object(...)) and identify JSON properties
function extractJSONAggregateColumns(
  sql: string,
  schema: JSONColumnMap | null = null
): {
  resultColumns: Set<string>;
  jsonProperties: Set<string>;
} {
  const resultColumns = new Set<string>();
  const jsonProperties = new Set<string>();

  // Look for json_group_array(json_object(...)) pattern
  if (sql.includes('json_group_array') && sql.includes('json_object')) {
    // Common column names used for aggregate results
    const commonJsonColumnNames = ['content', 'data', 'items', 'results'];
    for (const name of commonJsonColumnNames) {
      if (new RegExp(`\\b${name}\\b`, 'i').test(sql)) {
        resultColumns.add(name);
      }
    }

    // Match json_group_array(json_object(...)) and extract the content
    const pattern =
      /json_group_array\s*\(\s*json_object\s*\(([^)]*)\)\s*\)(?:\s+AS\s+["']?(\w+)["']?)?/gis;
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      if (match[2]) {
        // If there's an alias, add it as a result column
        resultColumns.add(match[2]);
      }

      // Extract property names and column names from json_object
      if (match[1]) {
        // Match 'property_name', column_name pairs
        const propertyPattern = /'([^']+)'\s*,\s*([^,')]+)(?=\s*(?:,|$))/g;
        let propMatch;
        while ((propMatch = propertyPattern.exec(match[1])) !== null) {
          const propertyName = propMatch[1];
          const columnName = propMatch[2]?.trim();

          // Check if the source column is a JSON column
          if (schema && columnName && propertyName) {
            // Check all tables in schema to see if this column is JSON
            for (const [, columns] of schema.entries()) {
              if (columns.has(columnName)) {
                jsonProperties.add(propertyName);
                break;
              }
            }
          }
        }
      }
    }
  }

  return { resultColumns, jsonProperties };
}

// Extract table and column mappings from SQL to identify JSON columns
function extractTableColumnMappings(sql: string): Map<string, string> {
  const columnToTable = new Map<string, string>();

  // Extract table names from FROM and JOIN clauses
  // Matches: FROM "table_name" or JOIN "table_name"
  const tablePattern = /(?:FROM|JOIN)\s+"([^"]+)"/gi;
  const tables: string[] = [];
  let match;

  while ((match = tablePattern.exec(sql)) !== null) {
    const tableName = match[1];
    // Remove _local suffix if present to get base table name
    const baseTableName = tableName?.replace(/_local$/, '');
    if (baseTableName) {
      tables.push(baseTableName);
    }
  }

  // For simple SELECT * queries, all columns come from the tables
  if (sql.includes('SELECT *') || sql.includes('SELECT sub.*')) {
    // All columns from all tables are included
    for (const table of tables) {
      // Check if this is from a local table query (contains _local references)
      const isLocalQuery = sql.includes(`"${table}_local"`);

      const jsonCols = isLocalQuery
        ? JSON_COLUMNS_MAP_LOCAL.get(`${table}_local`)
        : JSON_COLUMNS_MAP.get(table);

      if (jsonCols) {
        for (const col of jsonCols) {
          columnToTable.set(col, table);
        }
      }
    }
  }

  // Extract specific column selections
  // Matches: "table"."column" or just "column"
  const columnPattern = /(?:"([^"]+)"\.)?"([^"]+)"/g;
  const selectMatch = /SELECT\s+(.*?)\s+FROM/i.exec(sql);

  if (selectMatch?.[1]) {
    const selectClause = selectMatch[1];
    let colMatch;

    while ((colMatch = columnPattern.exec(selectClause)) !== null) {
      const tableNameRaw = colMatch[1];
      const columnName = colMatch[2];

      if (columnName && tableNameRaw) {
        // Explicit table.column reference
        const isLocal = tableNameRaw.endsWith('_local');
        const tableName = tableNameRaw.replace(/_local$/, '');

        const jsonMap = isLocal ? JSON_COLUMNS_MAP_LOCAL : JSON_COLUMNS_MAP;
        const checkTableName = isLocal ? `${tableName}_local` : tableName;

        if (jsonMap.get(checkTableName)?.has(columnName)) {
          columnToTable.set(columnName, tableName);
        }
      } else if (columnName) {
        // Just column name - check all tables in query
        for (const table of tables) {
          // Check if this query uses local tables
          const isLocalQuery = sql.includes(`"${table}_local"`);
          const jsonMap = isLocalQuery
            ? JSON_COLUMNS_MAP_LOCAL
            : JSON_COLUMNS_MAP;
          const checkTableName = isLocalQuery ? `${table}_local` : table;

          if (jsonMap.get(checkTableName)?.has(columnName)) {
            columnToTable.set(columnName, table);
            break;
          }
        }
      }
    }
  }

  return columnToTable;
}

// Parse JSON columns in query results
function parseJSONColumns<T>(rows: T[], sql: string): T[] {
  if (rows.length === 0) return rows;

  // Get columns defined as text({ mode: 'json' }) in schema
  const columnMappings = extractTableColumnMappings(sql);

  // Get columns from json_group_array(json_object(...)) results
  // Pass the schema so we can identify JSON properties within json_object
  // Combine both regular and local JSON column maps for checking
  const combinedSchema = new Map<string, Set<string>>();
  for (const [table, cols] of JSON_COLUMNS_MAP) {
    combinedSchema.set(table, cols);
  }
  for (const [table, cols] of JSON_COLUMNS_MAP_LOCAL) {
    // Local tables may have same column names as regular tables
    const baseTable = table.replace(/_local$/, '');
    if (!combinedSchema.has(baseTable)) {
      combinedSchema.set(baseTable, cols);
    } else {
      // Merge column sets
      const existing = combinedSchema.get(baseTable)!;
      for (const col of cols) {
        existing.add(col);
      }
    }
  }
  const aggregateInfo = extractJSONAggregateColumns(sql, combinedSchema);

  if (columnMappings.size === 0 && aggregateInfo.resultColumns.size === 0) {
    // No JSON columns detected
    return rows;
  }

  // Parse JSON columns in each row
  return rows.map((row) => {
    const parsedRow = { ...row } as Record<string, unknown>;

    // Parse columns defined with text({ mode: 'json' }) in schema
    for (const [columnName, tableName] of columnMappings) {
      if (
        columnName in parsedRow &&
        typeof parsedRow[columnName] === 'string'
      ) {
        try {
          parsedRow[columnName] = JSON.parse(parsedRow[columnName]);
        } catch (e) {
          console.warn(
            `Failed to parse JSON column ${tableName}.${columnName}:`,
            e
          );
        }
      }
    }

    // Parse json_group_array(json_object()) results
    for (const columnName of aggregateInfo.resultColumns) {
      if (
        columnName in parsedRow &&
        typeof parsedRow[columnName] === 'string'
      ) {
        try {
          const parsed = JSON.parse(parsedRow[columnName]);
          parsedRow[columnName] = parsed;

          // If we have JSON properties to parse within the objects
          if (Array.isArray(parsed) && aggregateInfo.jsonProperties.size > 0) {
            parsedRow[columnName] = parsed.map((item: unknown) => {
              if (typeof item === 'object' && item !== null) {
                const itemObj = item as Record<string, unknown>;

                // Parse known JSON properties
                for (const propName of aggregateInfo.jsonProperties) {
                  if (
                    propName in itemObj &&
                    typeof itemObj[propName] === 'string'
                  ) {
                    try {
                      itemObj[propName] = JSON.parse(itemObj[propName]);
                    } catch {
                      // Keep as string if parsing fails
                    }
                  }
                }
              }
              return item;
            });
          }
        } catch (e) {
          console.warn(
            `Failed to parse JSON aggregate column ${columnName}:`,
            e
          );
        }
      }
    }

    return parsedRow as T;
  });
}

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

  // Extract ORDER BY clause from the original query
  // Match ORDER BY at the end of the query (case-insensitive)
  const orderByRegex = /\s+ORDER\s+BY\s+.+$/i;
  const orderByMatch = orderByRegex.exec(substituted);
  let orderByClause = '';
  let queryWithoutOrderBy = substituted;

  if (orderByMatch) {
    orderByClause = orderByMatch[0];
    queryWithoutOrderBy = substituted.replace(orderByRegex, '');
  }

  const mainSource = hybridDataSourceOptions.synced;
  let mainQuery = `SELECT sub.*, '${mainSource}' AS source FROM (${queryWithoutOrderBy}) AS sub`;

  // Replace json_group_array(json_array(...)) with json_group_array(json_object(...))
  mainQuery = mainQuery.replace(
    /json_group_array\(json_array\(([^)]+)\)\)/g,
    (match, columns: string) => {
      const columnList = columns
        .split(',')
        .map((col: string) => col.trim().replaceAll('"', ''));
      const objectPairs = columnList
        .map((col: string) => `'${col}', ${col}`)
        .join(', ');
      return `json_group_array(json_object(${objectPairs}))`;
    }
  );

  let localQuery = mainQuery.replace(
    `'${mainSource}'`,
    `'${hybridDataSourceOptions.local}'`
  );

  // Replace table names in FROM, JOIN, WHERE, and ORDER BY clauses with a single regex
  Object.keys(drizzleSchema).forEach((key) => {
    localQuery = localQuery.replaceAll(`"${key}"`, `"${key}_local"`);
  });

  // Create the UNION query and apply ORDER BY at the end if it exists
  let unionQuery = `${mainQuery} UNION ${localQuery}`;

  if (orderByClause) {
    // Update the ORDER BY clause to reference columns from the UNION result
    // Since we're using sub.*, we need to ensure column references work correctly
    unionQuery += orderByClause;
  }

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
  const sql = mergedSQL ?? mergeSQL(query);
  const result = await system.powersync.execute(sql);
  const rows = result.rows?._array as MergeQueryResult<T>[];

  // Automatically parse JSON columns based on schema
  const parsedRows = parseJSONColumns(rows, sql);

  return parsedRows;
}

export function toMergeCompilableQuery<T extends QueryInput<T>>(query: T) {
  const unionQuery = mergeSQL(query);

  return {
    execute: async () => {
      // mergeQuery already handles JSON parsing
      const data = await mergeQuery(query, unionQuery);
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
